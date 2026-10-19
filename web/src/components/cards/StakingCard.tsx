import { formatAmount, formatDateTime } from '../../lib/format'
import type { AssistantCall } from '../../hooks/useChat'
import type { StakingPayload, UnlockBucket, UnlockItem } from '../../types/api'
import { ExecutionDetail } from './ExecutionDetail'
import { Panel, PanelHeader, ProvenanceStrip } from './Panel'

/** sWBERA 赎回为 BERA 的解锁期，链上 WITHDRAWAL_COOLDOWN() = 604800 秒 */
const COOLDOWN_SECONDS = 604_800

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '已到期'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} 天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return `${hours} 小时 ${String(minutes).padStart(2, '0')} 分`
}

function Part({
  label,
  value,
  symbol,
  sub,
  tag,
  unavailable,
}: {
  label: string
  value?: string
  symbol?: string
  sub?: string
  tag?: string
  unavailable?: { reason: string }
}) {
  return (
    <div className="min-w-0 rounded-[10px] border border-line-soft bg-[#0d0d0c] px-4 py-3.5">
      <div className="text-[11.5px] text-ink-4">{label}</div>

      {unavailable ? (
        <>
          <div className="mt-1.5 text-[17px] leading-tight font-medium text-ink-4">暂不可得</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-4">{unavailable.reason}</p>
        </>
      ) : (
        <>
          <div className="num mt-1.5 flex flex-wrap items-baseline gap-1.5 text-[20px] leading-tight font-medium tracking-tight text-ink">
            {formatAmount(value)}
            <span className="text-[12px] font-normal text-ink-3">{symbol}</span>
          </div>
          {sub ? <p className="num mt-1 text-[11.5px] leading-relaxed text-ink-3">{sub}</p> : null}
          {tag ? <p className="mt-1.5 text-[11.5px] text-gold/90">{tag}</p> : null}
        </>
      )}
    </div>
  )
}

function UnlockProgress({ item, symbol }: { item: UnlockItem; symbol: string }) {
  const used = Math.min(
    COOLDOWN_SECONDS,
    Math.max(0, COOLDOWN_SECONDS - item.remaining_seconds),
  )
  const percent = (used / COOLDOWN_SECONDS) * 100

  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="num text-[12.5px] text-ink-2">
          {formatAmount(item.assets)} {symbol} 解锁进度
          <span className="ml-2 text-[11px] text-ink-4">#{item.request_id}</span>
        </span>
        <span className="num text-[11.5px] text-ink-4">
          剩余 {formatRemaining(item.remaining_seconds)} / 共 7 天
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-500"
          style={{ width: `${Math.max(1.5, percent)}%` }}
        />
      </div>
    </div>
  )
}

export function StakingCard({
  payload,
  call,
  elapsedMs,
}: {
  payload: StakingPayload
  call: AssistantCall
  elapsedMs?: number
}) {
  const sources = Array.from(new Set(call.provenance.map((item) => item.source)))
  const latestAt = call.provenance
    .map((item) => item.at)
    .sort()
    .at(-1)

  const { in_position: position, unlocking, claimable } = payload

  const waitingSoonest = unlocking.items.length
    ? Math.min(...unlocking.items.map((item) => item.remaining_seconds))
    : 0

  const bucket = (
    data: UnlockBucket,
    tag: string,
  ): { value?: string; sub?: string; unavailable?: { reason: string } } => {
    if (!data.available) {
      return { unavailable: { reason: data.reason ?? '本次结果未返回该部分数据' } }
    }
    const count = data.items.length
    const sub = count === 0 ? tag : `${count} 笔 · ${tag}`
    return { value: data.total_assets, sub }
  }

  const waiting = bucket(
    unlocking,
    unlocking.items.length > 0 ? `预计最早 ${formatRemaining(waitingSoonest)} 可领取` : '没有排队中的解锁',
  )

  const claimableCount = claimable.items.length

  return (
    <Panel>
      <PanelHeader title="质押情况" subtitle="三部分分列 · 未合并" />

      <ProvenanceStrip
        sources={sources}
        block={payload.block_height}
        at={latestAt}
        note="与公开资料冲突时以链上为准"
      />

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <Part
          label={`${position.symbol} 持仓`}
          value={position.shares}
          symbol={position.symbol}
          sub={`≈ ${formatAmount(position.equivalent_wbera)} WBERA 等值`}
          tag="当前核心价值捕获层"
        />
        <Part
          label="Vault 在押份额"
          value={position.equivalent_wbera}
          symbol="BERA"
          sub="按链上兑换率折算"
        />
        <Part
          label="解锁排队中"
          value={waiting.value}
          symbol="BERA"
          sub={waiting.sub}
          unavailable={waiting.unavailable}
        />
      </div>

      {unlocking.items.map((item) => (
        <div key={item.request_id} className="border-t border-line-soft">
          <UnlockProgress item={item} symbol="BERA" />
        </div>
      ))}

      <div className="border-t border-line-soft px-5 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <span
              className={
                claimableCount > 0
                  ? 'size-1.5 shrink-0 rounded-full bg-gold'
                  : 'size-1.5 shrink-0 rounded-full bg-ink-4'
              }
              aria-hidden
            />
            可领取
            <span className="text-[11.5px] text-ink-4">解锁完成且尚未领取的份额</span>
          </span>
          <span className="num text-[13px] text-ink">
            {formatAmount(claimable.total_assets)}
            <span className="ml-1 text-[11.5px] text-ink-4">BERA</span>
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-4">
          {claimableCount > 0
            ? `${claimableCount} 笔已到期（最早 ${formatDateTime(
                new Date(claimable.items[0].ready_at * 1000).toISOString(),
              )}），领取与再质押属 v2 范围。`
            : '当前无解锁完成待领取的份额。v1 全程只读，领取与再质押操作属 v2 范围。'}
        </p>
      </div>

      <div className="border-t border-line-soft px-5 py-2.5 text-[11px] text-ink-4">
        口径：会话地址 · Berachain Mainnet 80094 · 解锁期 7 天 · 未展示收益率数据（各来源口径差异大，避免误导）
      </div>

      <ExecutionDetail
        name={call.name}
        args={call.arguments}
        provenance={call.provenance}
        elapsedMs={elapsedMs}
      />
    </Panel>
  )
}
