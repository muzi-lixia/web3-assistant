import { useCallback, useRef, useState } from 'react'
import { ChatStreamError, streamChat } from '../lib/sse'
import { useSessionStore } from '../store/session'
import type {
  CapabilityPayload,
  ChatErrorPayload,
  ProvenanceItem,
} from '../types/api'
import { toCapabilityPayload } from '../types/api'

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export interface UserMessage {
  id: string
  role: 'user'
  text: string
  at: number
}

export interface AssistantCall {
  name: string
  /** 模型实际传给工具的参数，用于「执行详情」 */
  arguments: Record<string, unknown>
  /** 形状与能力不符时为空，此时只出文本不出卡 */
  payload?: CapabilityPayload
  provenance: ProvenanceItem[]
}

export interface AssistantMessage {
  id: string
  role: 'assistant'
  status: 'streaming' | 'done' | 'error'
  at: number
  capability?: string
  intentReason?: string
  text?: string
  calls?: AssistantCall[]
  /** 从发出提问到收到数据的时间，用于「执行详情」 */
  elapsedMs?: number
  error?: ChatErrorPayload
  stopped?: boolean
}

export type ChatMessage = UserMessage | AssistantMessage

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const conversationRef = useRef<string | null>(null)

  const patch = useCallback((id: string, changes: Partial<AssistantMessage>) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id && message.role === 'assistant'
          ? { ...message, ...changes }
          : message,
      ),
    )
  }, [])

  const update = useCallback(
    (id: string, updater: (message: AssistantMessage) => AssistantMessage) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id && message.role === 'assistant' ? updater(message) : message,
        ),
      )
    },
    [],
  )

  const run = useCallback(
    async (text: string) => {
      const assistantId = nextId('assistant')
      const controller = new AbortController()
      const startedAt = performance.now()
      controllerRef.current = controller
      setIsStreaming(true)

      setMessages((prev) => [
        ...prev,
        { id: nextId('user'), role: 'user', text, at: Date.now() },
        { id: assistantId, role: 'assistant', status: 'streaming', at: Date.now() },
      ])

      try {
        await streamChat(
          text,
          conversationRef.current,
          (event) => {
            switch (event.type) {
              case 'context':
                if (event.conversationId) conversationRef.current = event.conversationId
                break
              case 'intent':
                patch(assistantId, {
                  capability: event.capability,
                  intentReason: event.reason,
                })
                break
              case 'delta':
                update(assistantId, (message) => ({
                  ...message,
                  text: (message.text ?? '') + event.text,
                }))
                break
              case 'answer':
                patch(assistantId, { text: event.text })
                break
              case 'data':
                patch(assistantId, {
                  elapsedMs: Math.round(performance.now() - startedAt),
                  calls: event.calls.map((call) => ({
                    name: call.name,
                    arguments: call.arguments,
                    payload: toCapabilityPayload(call.name, call.data),
                    provenance: call.provenance,
                  })),
                })
                break
              case 'error':
                patch(assistantId, { status: 'error', error: event.error })
                break
              case 'done':
                patch(assistantId, { status: 'done' })
                break
            }
          },
          controller.signal,
        )
      } catch (caught) {
        if (controller.signal.aborted) {
          patch(assistantId, { status: 'done', stopped: true })
        } else if (caught instanceof ChatStreamError && caught.status === 401) {
          useSessionStore.getState().signOut('expired')
        } else {
          patch(assistantId, {
            status: 'error',
            error: {
              code: 'network_error',
              message: caught instanceof Error ? caught.message : '网络异常，请稍后重试',
              retryable: true,
            },
          })
        }
      } finally {
        controllerRef.current = null
        setIsStreaming(false)
      }
    },
    [patch, update],
  )

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text || isStreaming) return
      void run(text)
    },
    [isStreaming, run],
  )

  const retry = useCallback(
    (text: string) => {
      if (isStreaming) return
      void run(text)
    },
    [isStreaming, run],
  )

  const stop = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  return { messages, isStreaming, send, retry, stop }
}
