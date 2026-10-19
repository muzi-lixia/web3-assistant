import { useEffect, useState } from 'react'
import { LoginPage } from './pages/LoginPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { api } from './lib/api'
import { useSessionStore } from './store/session'

export default function App() {
  const session = useSessionStore((state) => state.session)
  const signOut = useSessionStore((state) => state.signOut)
  const [checking, setChecking] = useState(Boolean(session))

  // 刷新页面后用 /auth/me 验证本地令牌是否仍然有效；网络异常时保留本地会话
  useEffect(() => {
    const token = useSessionStore.getState().session?.token
    if (!token) {
      setChecking(false)
      return
    }

    let cancelled = false
    api
      .me()
      .catch((error: unknown) => {
        const status = (error as { status?: number })?.status
        if (!cancelled && status === 401) signOut('expired')
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [signOut])

  if (checking && session) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-line border-t-gold" />
          <p className="text-[12px] text-ink-3">正在校验会话…</p>
        </div>
      </div>
    )
  }

  return session ? <WorkspacePage /> : <LoginPage />
}
