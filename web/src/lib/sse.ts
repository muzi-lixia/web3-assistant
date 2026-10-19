import { authHeaders } from './api'
import type { ChatErrorPayload, ProvenanceItem } from '../types/api'

export type ChatStreamEvent =
  | { type: 'context'; conversationId: string }
  | { type: 'intent'; stage: string }
  | { type: 'answer'; text: string }
  | { type: 'data'; payload: unknown }
  | { type: 'provenance'; items: ProvenanceItem[] }
  | { type: 'error'; error: ChatErrorPayload }
  | { type: 'done' }

const BASE = import.meta.env.VITE_API_BASE ?? ''

export class ChatStreamError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ChatStreamError'
    this.status = status
  }
}

function parseFrame(frame: string): ChatStreamEvent | null {
  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return null

  let data: unknown = null
  try {
    data = JSON.parse(dataLines.join('\n'))
  } catch {
    return null
  }

  switch (eventName) {
    case 'context':
      return {
        type: 'context',
        conversationId: String((data as { conversation_id?: string })?.conversation_id ?? ''),
      }
    case 'intent':
      return {
        type: 'intent',
        stage: String((data as { stage?: string })?.stage ?? 'recognized'),
      }
    case 'answer':
      return { type: 'answer', text: String((data as { text?: string })?.text ?? '') }
    case 'data':
      return { type: 'data', payload: (data as { payload?: unknown })?.payload }
    case 'provenance':
      return {
        type: 'provenance',
        items: ((data as { items?: ProvenanceItem[] })?.items ?? []) as ProvenanceItem[],
      }
    case 'error': {
      const payload = data as Partial<ChatErrorPayload>
      return {
        type: 'error',
        error: {
          code: String(payload?.code ?? 'internal_error'),
          message: String(payload?.message ?? '服务内部错误，请稍后重试'),
          retryable: Boolean(payload?.retryable),
        },
      }
    }
    case 'done':
      return { type: 'done' }
    default:
      return null
  }
}

/**
 * POST /api/v1/chat 返回 text/event-stream；EventSource 不支持 POST，
 * 因此用 fetch + ReadableStream 手工按空行切帧。
 * conversationId 为空时由服务端新建，并在首个 context 事件里回传。
 */
export async function streamChat(
  message: string,
  conversationId: string | null,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = authHeaders()
  headers.set('Accept', 'text/event-stream')
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`${BASE}/api/v1/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(conversationId ? { message, conversation_id: conversationId } : { message }),
    signal,
  })

  if (!response.ok) {
    let detail = `查询失败（HTTP ${response.status}）`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body?.detail) detail = body.detail
    } catch {
      /* 保留默认文案 */
    }
    throw new ChatStreamError(detail, response.status)
  }

  if (!response.body) {
    throw new ChatStreamError('当前浏览器不支持流式响应', 0)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const event = parseFrame(frame)
        if (event) onEvent(event)
        boundary = buffer.indexOf('\n\n')
      }
    }

    buffer += decoder.decode()
    if (buffer.trim()) {
      const event = parseFrame(buffer)
      if (event) onEvent(event)
    }
  } finally {
    reader.releaseLock()
  }
}
