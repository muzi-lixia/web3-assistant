import { useCallback, useRef, useState } from 'react'
import { ChatStreamError, streamChat } from '../lib/sse'
import { useSessionStore } from '../store/session'
import type {
  CapabilityPayload,
  ChatErrorPayload,
  ProvenanceItem,
} from '../types/api'
import { isAssetPayload, isStakingPayload } from '../types/api'

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

export interface AssistantMessage {
  id: string
  role: 'assistant'
  status: 'streaming' | 'done' | 'error'
  at: number
  intentStage?: string
  text?: string
  payload?: CapabilityPayload
  provenance?: ProvenanceItem[]
  error?: ChatErrorPayload
  stopped?: boolean
  demo?: boolean
}

export type ChatMessage = UserMessage | AssistantMessage

function classify(payload: unknown): CapabilityPayload | undefined {
  if (isAssetPayload(payload)) return { capability: 'asset_balance', answer: payload }
  if (isStakingPayload(payload)) return { capability: 'staking_position', answer: payload }
  return undefined
}

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

  const run = useCallback(
    async (text: string) => {
      const assistantId = nextId('assistant')
      const controller = new AbortController()
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
                patch(assistantId, { intentStage: event.stage })
                break
              case 'answer':
                patch(assistantId, { text: event.text })
                break
              case 'data': {
                const payload = classify(event.payload)
                if (payload) patch(assistantId, { payload })
                break
              }
              case 'provenance':
                patch(assistantId, { provenance: event.items })
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
    [patch],
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

  const pushDemoMessage = useCallback((payload: CapabilityPayload, text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId('assistant'),
        role: 'assistant',
        status: 'done',
        at: Date.now(),
        text,
        payload,
        provenance: [],
        demo: true,
      },
    ])
  }, [])

  return { messages, isStreaming, send, retry, stop, pushDemoMessage }
}
