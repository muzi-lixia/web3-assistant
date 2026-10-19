import { useEffect, useMemo, useState } from 'react'
import { Drawer } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ChatThread } from '../components/ChatThread'
import { Composer } from '../components/Composer'
import { InfoDrawer, type InfoKind } from '../components/InfoDrawer'
import { Sidebar, type NavKey } from '../components/Sidebar'
import { TokenScopeDrawer } from '../components/TokenScopeDrawer'
import { TopBar } from '../components/TopBar'
import { useChat } from '../hooks/useChat'
import { api } from '../lib/api'
import { getToken, useSessionStore } from '../store/session'

const SHORTCUTS: Partial<Record<NavKey, string>> = {
  assets: '我钱包里现在有什么',
  transactions: '最近都发生了什么',
  staking: '我的质押什么时候能取出来',
}

export function WorkspacePage() {
  const session = useSessionStore((state) => state.session)
  const signOut = useSessionStore((state) => state.signOut)
  const { messages, isStreaming, send, retry, stop } = useChat()
  const [scopeOpen, setScopeOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [info, setInfo] = useState<InfoKind | null>(null)
  const [tokenCount, setTokenCount] = useState<number | null>(null)

  const scopeQuery = useQuery({
    queryKey: ['token-scope'],
    queryFn: api.readScope,
    enabled: Boolean(session),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!scopeQuery.data) return
    setTokenCount(scopeQuery.data.tokens.filter((token) => token.selected).length)
  }, [scopeQuery.data])

  const lastSource = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.role !== 'assistant') continue
      const call = message.calls?.find((item) => item.provenance.length > 0)
      if (call) return call.provenance[0]?.source
    }
    return undefined
  }, [messages])

  const handleNav = (key: NavKey) => {
    setNavOpen(false)
    if (key === 'scope') {
      setScopeOpen(true)
      return
    }
    if (key === 'sources' || key === 'help') {
      setInfo(key)
      return
    }
    const question = SHORTCUTS[key]
    if (question) send(question)
  }

  const handleSignOut = () => {
    const token = getToken()
    signOut('manual')
    // 本地会话已清，服务端撤销失败也不影响退出结果
    if (token) void api.logout(token).catch(() => undefined)
  }

  if (!session) return null

  return (
    <div className="flex h-dvh bg-canvas-soft">
      <Sidebar active="agent" onSelect={handleNav} className="hidden lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          address={session.address}
          displayAddress={session.displayAddress}
          tokenCount={tokenCount}
          lastSource={lastSource}
          onOpenScope={() => setScopeOpen(true)}
          onOpenNav={() => setNavOpen(true)}
          onSignOut={handleSignOut}
        />

        <main className="flex min-h-0 flex-1 flex-col">
          <ChatThread messages={messages} isStreaming={isStreaming} onRetry={retry} onPick={send} />
          <Composer onSend={send} onStop={stop} isStreaming={isStreaming} />
        </main>
      </div>

      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        placement="left"
        size={260}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <Sidebar active="agent" onSelect={handleNav} className="flex h-full w-full border-r-0" />
      </Drawer>

      <TokenScopeDrawer
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        onCountChange={setTokenCount}
      />

      <InfoDrawer kind={info} onClose={() => setInfo(null)} />
    </div>
  )
}
