import { formatClock } from '../lib/format'
import type { AssistantMessage as AssistantMessageData } from '../hooks/useChat'
import { BrandMark } from './BrandMark'
import { ErrorNotice } from './ErrorNotice'
import { AssetCard } from './cards/AssetCard'
import { StakingCard } from './cards/StakingCard'
import { TxCard } from './cards/TxCard'

const INTENT_LABELS: Record<string, string> = {
  asset_balance: '资产查询',
  staking_position: '质押查询',
  transaction_records: '交易记录',
}

function StreamingSkeleton() {
  return (
    <div className="space-y-2" aria-live="polite" aria-busy="true">
      <p className="text-[12px] text-ink-3">正在读取链上数据…</p>
      <div className="space-y-1.5">
        <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-line" />
        <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-line" />
        <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-line" />
      </div>
    </div>
  )
}

function IntentChip({ capability, streaming }: { capability?: string; streaming: boolean }) {
  if (!capability) {
    if (!streaming) return null
    return (
      <span className="rounded-sm border border-line bg-panel px-1.5 py-0.5 text-[10.5px] leading-none text-ink-4">
        意图识别中
      </span>
    )
  }
  return (
    <span className="rounded-sm border border-gold/25 bg-gold/[0.07] px-1.5 py-0.5 text-[10.5px] leading-none text-gold">
      意图识别 · {INTENT_LABELS[capability] ?? capability}
    </span>
  )
}

export function AssistantMessage({
  message,
  retryText,
  onRetry,
  busy,
}: {
  message: AssistantMessageData
  retryText?: string
  onRetry: (text: string) => void
  busy: boolean
}) {
  const { payload } = message

  return (
    <article className="flex gap-3">
      <BrandMark size={22} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
          <span className="font-medium text-ink-2">Berachain 助手</span>
          <span className="num text-ink-4">{formatClock(new Date(message.at).toISOString())}</span>
          {message.status === 'streaming' ? (
            <IntentChip streaming />
          ) : (
            <IntentChip capability={payload?.capability} streaming={false} />
          )}
          {message.demo ? (
            <span className="rounded-sm border border-warn/40 px-1.5 py-0.5 text-[10.5px] leading-none text-warn">
              示例数据
            </span>
          ) : null}
        </header>

        <div className="mt-2 space-y-3">
          {message.text ? (
            <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-ink">{message.text}</p>
          ) : null}

          {message.status === 'streaming' && !message.text ? <StreamingSkeleton /> : null}

          {payload?.capability === 'asset_balance' ? (
            <AssetCard payload={payload.answer} provenance={message.provenance ?? []} />
          ) : null}

          {payload?.capability === 'staking_position' ? (
            <StakingCard payload={payload.answer} provenance={message.provenance ?? []} />
          ) : null}

          {payload?.capability === 'transaction_records' ? (
            <TxCard payload={payload.answer} />
          ) : null}

          {message.stopped ? (
            <p className="text-[11.5px] text-ink-4">已停止生成（保留已返回的内容）</p>
          ) : null}

          {message.error ? (
            <ErrorNotice
              error={message.error}
              onRetry={
                retryText
                  ? () => {
                      onRetry(retryText)
                    }
                  : undefined
              }
              disabled={busy}
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}
