import { getToken, useSessionStore } from '../store/session'
import type {
  MeResponse,
  NonceResponse,
  ScopeResponse,
  VerifyResponse,
} from '../types/api'

const BASE = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  /** 该请求没有会话也能发起（登录链路），401 不使用「会话失效」语义 */
  anonymous?: boolean
}

export function authHeaders(): Headers {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const headers = authHeaders()
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${BASE}${path}`, { ...init, headers })

  if (response.status === 401 && !options.anonymous) {
    useSessionStore.getState().signOut('expired')
  }

  const raw = await response.text()
  let data: unknown = null
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = raw
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : `请求失败（HTTP ${response.status}）`
    throw new ApiError(detail, response.status)
  }

  return data as T
}

export const api = {
  nonce: (address: string) =>
    request<NonceResponse>(
      '/api/v1/auth/nonce',
      { method: 'POST', body: JSON.stringify({ address }) },
      { anonymous: true },
    ),

  verify: (message: string, signature: string) =>
    request<VerifyResponse>(
      '/api/v1/auth/verify',
      { method: 'POST', body: JSON.stringify({ message, signature }) },
      { anonymous: true },
    ),

  me: () => request<MeResponse>('/api/v1/auth/me'),

  readScope: () => request<ScopeResponse>('/api/v1/tokens'),

  saveScope: (addresses: string[]) =>
    request<ScopeResponse>('/api/v1/tokens', {
      method: 'PUT',
      body: JSON.stringify({ addresses }),
    }),
}
