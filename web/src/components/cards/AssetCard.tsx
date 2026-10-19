import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatAmount, formatUsd, isZeroAmount, sourceLabel } from '../../lib/format'
import type { AssistantCall } from '../../hooks/useChat'
import type { AssetPayload } from '../../types/api'
import { ExecutionDetail } from './ExecutionDetail'
import { CopyAddress, Panel, PanelHeader, ProvenanceStrip, StatLabel, StatValue } from './Panel'

export function AssetCard({
  payload,
  call,
  elapsedMs,
}: {
  payload: AssetPayload
  call: AssistantCall
  elapsedMs?: number
}) {
  const [showAll, setShowAll] = useState(false)

  const zeroCount = payload.items.filter((item) => isZeroAmount(item.amount)).length
  const visibleItems = showAll
    ? payload.items
    : payload.items.filter((item) => !isZeroAmount(item.amount))

  const sources = useMemo(
    () => Array.from(new Set(call.provenance.map((item) => item.source))),
    [call.provenance],
  )
  const latestAt = useMemo(() => {
    if (call.provenance.length === 0) return undefined
    return call.provenance
      .map((item) => item.at)
      .sort()
      .at(-1)
  }, [call.provenance])
  const valuationSource = call.provenance.find((item) => item.field.startsWith('valuation'))

  return (
    <Panel>
      <PanelHeader
        title="资产总览"
        subtitle={`${payload.items.length} 项范围内 token`}
        aside={
          <>
            <StatLabel>合计估值</StatLabel>
            <StatValue muted={payload.total_value_usd === '0.0000'}>
              {formatUsd(payload.total_value_usd)}
            </StatValue>
            {payload.valuation_note ? (
              <p className="mt-1 text-[11px] text-ink-4">不含未估值的项</p>
            ) : null}
          </>
        }
      />

      <ProvenanceStrip
        sources={sources}
        block={payload.block_height}
        at={latestAt}
        scope={`${payload.items.length} 项`}
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] sm:min-w-[560px]">
          <thead>
            <tr className="text-[11px] tracking-wide text-ink-4 uppercase">
              <th scope="col" className="px-5 py-3 text-left font-normal">
                Token
              </th>
              <th scope="col" className="px-4 py-3 text-right font-normal">
                余额
              </th>
              <th scope="col" className="px-4 py-3 text-right font-normal">
                估值 USD
              </th>
              <th scope="col" className="hidden px-5 py-3 text-right font-normal sm:table-cell">
                合约地址
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr
                key={`${item.symbol}-${item.address ?? 'native'}`}
                className="border-t border-line-soft/70 transition-colors hover:bg-white/[0.02]"
              >
                <th scope="row" className="px-5 py-3.5 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-ink">{item.symbol}</span>
                    {item.native ? (
                      <span className="rounded-sm border border-line bg-panel-raised px-1.5 py-0.5 text-[10px] leading-none text-ink-3">
                        原生
                      </span>
                    ) : null}
                  </span>
                  {item.address ? (
                    <span className="num mt-0.5 block text-[10.5px] text-ink-4 sm:hidden">
                      {item.address.slice(0, 6)}…{item.address.slice(-4)}
                    </span>
                  ) : null}
                </th>
                <td className="num px-4 py-3.5 text-right text-ink">{formatAmount(item.amount)}</td>
                <td
                  className={cn(
                    'num px-4 py-3.5 text-right',
                    item.value_usd ? 'text-ink' : 'text-ink-4',
                  )}
                >
                  {item.value_usd ? formatUsd(item.value_usd) : '暂不可用'}
                </td>
                <td className="hidden px-5 py-3.5 text-right sm:table-cell">
                  {item.address ? (
                    <CopyAddress address={item.address} />
                  ) : (
                    <span className="text-ink-4">native</span>
                  )}
                </td>
              </tr>
            ))}

            {visibleItems.length === 0 ? (
              <tr className="border-t border-line-soft/70">
                <td colSpan={4} className="px-5 py-6 text-center text-ink-3">
                  范围内没有非零余额的 token
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {payload.valuation_note ? (
        <p className="flex items-start gap-2 border-t border-line-soft bg-warn/[0.07] px-5 py-2.5 text-[11.5px] leading-relaxed text-warn">
          <span aria-hidden>⚠</span>
          <span>{payload.valuation_note}</span>
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-2.5 text-[11.5px]">
        {zeroCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="cursor-pointer text-gold/90 transition-colors hover:text-gold"
          >
            {showAll ? `收起 ${zeroCount} 项 0 余额` : `显示全部（含 ${zeroCount} 项 0 余额）`}
          </button>
        ) : (
          <span className="text-ink-4">范围内 token 均有非零余额</span>
        )}

        {valuationSource ? (
          <span className="text-ink-4">
            估值来源 {sourceLabel(valuationSource.source)} ·{' '}
            <span className="num">
              {new Date(valuationSource.at).toLocaleString('zh-CN', { hour12: false })}
            </span>
          </span>
        ) : null}
      </footer>

      <ExecutionDetail
        name={call.name}
        args={call.arguments}
        provenance={call.provenance}
        elapsedMs={elapsedMs}
      />
    </Panel>
  )
}
