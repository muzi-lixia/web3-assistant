import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ChatThread } from '../components/ChatThread'
import { Composer } from '../components/Composer'
import { TopBar } from '../components/TopBar'
import { TokenScopeDrawer } from '../components/TokenScopeDrawer'
import { useChat } from '../hooks/useChat'
import { api } from '../lib/api'
import { useSessionStore } from '../store/session'
import { TX_DEPTH_DAYS, TX_FIXTURE } from '../fixtures/transactions'

export function WorkspacePage() {
  const session = useSessionStore((state) => state.session)
  const signOut = useSessionStore((state) => state.signOut)
  const { messages, isStreaming, send, retry, stop, pushDemoMessage } = useChat()
  const [scopeOpen, setScopeOpen] = useState(false)
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
      if (message.role === 'assistant' && message.provenance?.length) {
        return message.provenance[0]?.source
      }
    }
    return undefined
  }, [messages])

  const insertTxDemo = useCallback(() => {
    pushDemoMessage(
      {
        capability: 'transaction_records',
        answer: { rangeDays: 30, depthDays: TX_DEPTH_DAYS, records: TX_FIXTURE },
      },
      '（示例）最近 30 天共 18 笔交易：普通 6 笔、内部 3 笔、ERC-20 转账 9 笔。数据源仅提供最近 90 天记录，更早的数据无法获取。',
    )
  }, [pushDemoMessage])

  if (!session) return null

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TopBar
        address={session.address}
        displayAddress={session.displayAddress}
        tokenCount={tokenCount}
        lastSource={lastSource}
        onOpenScope={() => setScopeOpen(true)}
        onSignOut={() => signOut('manual')}
      />

      <main className="flex min-h-0 flex-1 flex-col">
        <ChatThread
          messages={messages}
          isStreaming={isStreaming}
          onRetry={retry}
          onPick={send}
        />
        <Composer onSend={send} onStop={stop} isStreaming={isStreaming} />
      </main>

      <TokenScopeDrawer
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        onCountChange={setTokenCount}
      />

      {import.meta.env.DEV ? (
        <div className="fixed bottom-3 left-3 z-30 hidden sm:block">
          <Button size="small" onClick={insertTxDemo} className="!text-[11px] !text-ink-3">
            示例：交易记录卡
          </Button>
        </div>
      ) : null}
    </div>
  )
}
