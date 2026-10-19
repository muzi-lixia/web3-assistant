import { useMemo } from 'react'
import { formatAmount } from '../../lib/format'
import type { ProvenanceItem, StakingPayload } from '../../types/api'
import { Panel, PanelHeader, ProvenanceStrip, StatLabel, StatValue } from './Panel'

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
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <div className="text-[11px] tracking-wide text-ink-3">{label}</div>

      {unavailable ? (
        <>
          <div className="mt-2 text-[17px] leading-tight font-medium text-ink-4">暂不可得</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-4">{unavailable.reason}</p>
        </>
      ) : (
        <>
          <div className="num mt-2 flex flex-wrap items-baseline gap-1.5 text-[20px] leading-tight font-medium tracking-tight text-ink">
            {formatAmount(value)}
            <span className="text-[12px] font-normal text-ink-3">{symbol}</span>
          </div>
          {sub ? <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{sub}</p> : null}
          {tag ? (
            <span className="mt-2 inline-block text-[11px] text-gold">{tag}</span>
          ) : null}
        </>
      )}
    </div>
  )
}

export function StakingCard({
  payload,
  provenance,
}: {
  payload: StakingPayload
  provenance: ProvenanceItem[]
}) {
  const sources = useMemo(
    () => Array.from(new Set(provenance.map((item) => item.source))),
    [provenance],
  )
  const latestAt = provenance
    .map((item) => item.at)
    .sort()
    .at(-1)

  const { in_position: position, unlocking, claimable } = payload
  const unlockReason = unlocking.reason ?? '本次结果未返回解锁队列数据'
  const claimReason = claimable.reason ?? '依赖解锁队列，随其一起暂不可得'

  return (
    <Panel>
      <PanelHeader
        title="质押情况"
        subtitle="三部分分列 · 未合并"
        aside={
          <>
            <StatLabel>等值折算</StatLabel>
            <StatValue>
              {formatAmount(position.equivalent_wbera)}
              <span className="ml-1 text-[12px] font-normal text-ink-3">WBERA</span>
            </StatValue>
            <p className="mt-1 text-[11px] text-ink-4">按链上兑换率折算，不含解锁中份额</p>
          </>
        }
      />

      <ProvenanceStrip
        sources={sources}
        block={payload.block_height}
        at={latestAt}
        scope="会话地址"
      />

      <div className="grid divide-y divide-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Part
          label={`${position.symbol} 持仓`}
          value={position.shares}
          symbol={position.symbol}
          sub={`≈ ${formatAmount(position.equivalent_wbera)} WBERA 等值`}
          tag="当前核心价值捕获层"
        />
        <Part
          label="Vault 在押份额"
          unavailable={{ reason: '本次结果未返回 Vault 在押份额读取' }}
        />
        <Part label="解锁排队中" unavailable={{ reason: unlockReason }} />
      </div>

      <div className="border-t border-line-soft px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11.5px] text-ink-3">解锁进度</span>
          <span className="text-[11.5px] text-ink-4">不可得</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-4">
          {unlocking.available
            ? '解锁份额与预计可领取时间已由服务端返回。'
            : `无法计算预计可领取时间：${unlockReason}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2 text-[12px] text-ink-2">
          <span className="size-1.5 rounded-full bg-ink-4" aria-hidden />
          可领取
        </span>
        <span className="num text-[12.5px] text-ink-4">
          {claimable.available ? '—' : '暂不可得'}
        </span>
      </div>
      <p className="px-4 pb-3 text-[11px] leading-relaxed text-ink-4 sm:px-5">{claimReason}</p>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-2.5 text-[11px] text-ink-4 sm:px-5">
        <span>口径：会话地址 · Berachain Mainnet 80094</span>
        <span>未展示收益率数据（各来源口径差异大，避免误导）</span>
      </footer>
    </Panel>
  )
}
