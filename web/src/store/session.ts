import { create } from 'zustand'
import type { VerifyResponse } from '../types/api'

const STORAGE_KEY = 'berachain-assistant.session.v1'

export interface StoredSession {
  token: string
  address: string
  displayAddress: string
  expiresAt: number
}

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed?.token || !parsed?.address || !parsed?.expiresAt) return null
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStored(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 隐私模式下写入失败时退化为仅内存态 */
  }
}

interface SessionState {
  session: StoredSession | null
  expiredNotice: boolean
  signIn: (payload: VerifyResponse) => void
  signOut: (reason?: 'manual' | 'expired') => void
  dismissNotice: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: readStored(),
  expiredNotice: false,

  signIn: (payload) => {
    const next: StoredSession = {
      token: payload.token,
      address: payload.address,
      displayAddress: payload.display_address,
      expiresAt: Date.now() + payload.expires_in * 1000,
    }
    writeStored(next)
    set({ session: next, expiredNotice: false })
  },

  signOut: (reason = 'manual') => {
    writeStored(null)
    set({ session: null, expiredNotice: reason === 'expired' })
  },

  dismissNotice: () => set({ expiredNotice: false }),
}))

export function getToken(): string | null {
  return useSessionStore.getState().session?.token ?? null
}
