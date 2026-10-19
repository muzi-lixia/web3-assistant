import { Tooltip } from 'antd'
import { formatClock } from '../lib/format'
import type { AssistantCall, AssistantMessage as AssistantMessageData } from '../hooks/useChat'
import { BrandMark } from './BrandMark'
import { ErrorNotice } from './ErrorNotice'
import { AssetCard } from './cards/AssetCard'
import { StakingCard } from './cards/StakingCard'
import { TxCard } from './cards/TxCard'

const INTENT_LABELS: Record<string, string> = {
  asset_balance: '资产查询',
  staking_position: '质押查询',
  transaction_history: '交易记录',
}

function TypingDots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      {label ? <span className="text-[12px] text-ink-3">{label}</span> : null}
      <span className="inline-flex items-end gap-[3px]">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-[3px] animate-bounce rounded-full bg-gold"
            style={{ animationDelay: `${index * 160}ms`, animationDuration: '900ms' }}
          />
        ))}
      </span>
    </span>
  )
}

function IntentChip({
  capability,
  reason,
  streaming,
}: {
  capability?: string
  reason?: string
  streaming: boolean
}) {
  if (!capability) {
    if (!streaming) return null
    return (
      <span className="rounded-sm border border-line bg-panel px-1.5 py-0.5 text-[10.5px] leading-none text-ink-4">
        意图识别中
      </span>
    )
  }
  return (
    <Tooltip title={reason}>
      <span className="rounded-sm border border-gold/25 bg-gold/[0.07] px-1.5 py-0.5 text-[10.5px] leading-none text-gold">
        意图识别 · {INTENT_LABELS[capability] ?? capability}
      </span>
    </Tooltip>
  )
}

function CallCard({ call, elapsedMs }: { call: AssistantCall; elapsedMs?: number }) {
  const { payload } = call
  if (!payload) return null

  if (payload.capability === 'asset_balance') {
    return <AssetCard payload={payload.data} call={call} elapsedMs={elapsedMs} />
  }
  if (payload.capability === 'staking_position') {
    return <StakingCard payload={payload.data} call={call} elapsedMs={elapsedMs} />
  }
  return <TxCard payload={payload.data} call={call} elapsedMs={elapsedMs} />
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
  const streaming = message.status === 'streaming'

  return (
    <article className="flex gap-3">
      <BrandMark size={26} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
          <span className="text-[12px] font-medium text-ink-2">Berachain 助手</span>
          <span className="num text-ink-4">{formatClock(new Date(message.at).toISOString())}</span>
          <IntentChip
            capability={message.capability}
            reason={message.intentReason}
            streaming={streaming}
          />
        </header>

        <div className="mt-2.5 space-y-3">
          {message.text ? (
            <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-ink">
              {message.text}
              {streaming ? (
                <span className="ml-2">
                  <TypingDots />
                </span>
              ) : null}
            </p>
          ) : null}

          {streaming && !message.text ? <TypingDots label="正在读取链上数据…" /> : null}

          {message.calls?.map((call, index) => (
            <CallCard key={`${call.name}-${index}`} call={call} elapsedMs={message.elapsedMs} />
          ))}

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
