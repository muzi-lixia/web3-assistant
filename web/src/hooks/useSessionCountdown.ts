import { useEffect, useState } from 'react'
import { useSessionStore } from '../store/session'

export function useSessionCountdown(): { remainingMs: number; expired: boolean } {
  const session = useSessionStore((state) => state.session)
  const signOut = useSessionStore((state) => state.signOut)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!session) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session])

  const remainingMs = session ? Math.max(0, session.expiresAt - now) : 0

  useEffect(() => {
    if (!session) return
    if (session.expiresAt <= now) signOut('expired')
  }, [session, now, signOut])

  return { remainingMs, expired: Boolean(session) && remainingMs === 0 }
}
