import { useState } from 'react'
import { cn } from '../../lib/cn'
import { formatAmount, formatBlock, formatDateTime } from '../../lib/format'
import type { AssistantCall } from '../../hooks/useChat'
import type { TransactionItem, TransactionPayload } from '../../types/api'
import { ExecutionDetail } from './ExecutionDetail'
import { CopyAddress, Panel, PanelHeader, ProvenanceStrip, StatLabel, StatValue } from './Panel'

const COLLAPSED_ROWS = 8

function Timestamp({ value }: { value: number }) {
  return (
    <span className="num whitespace-nowrap">
      {formatDateTime(new Date(value * 1000).toISOString())}
    </span>
  )
}

function DirectionChip({ direction }: { direction: TransactionItem['direction'] }) {
  return (
    <span
      className={cn(
        'rounded-sm border px-1.5 py-0.5 text-[10.5px] leading-none whitespace-nowrap',
        direction === 'in'
          ? 'border-ok/30 bg-ok/[0.08] text-ok'
          : 'border-line bg-panel-raised text-ink-3',
      )}
    >
      {direction === 'in' ? '转入' : '转出'}
    </span>
  )
}

function Peer({ record }: { record: TransactionItem }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-ink-4" aria-hidden>
        {record.direction === 'in' ? '←' : '→'}
      </span>
      <CopyAddress address={record.direction === 'in' ? record.from : record.to} />
    </span>
  )
}

export function TxCard({
  payload,
  call,
  elapsedMs,
}: {
  payload: TransactionPayload
  call: AssistantCall
  elapsedMs?: number
}) {
  const [expanded, setExpanded] = useState(false)

  const rows = expanded ? payload.items : payload.items.slice(0, COLLAPSED_ROWS)
  const hidden = payload.items.length - rows.length
  const failed = payload.items.filter((item) => item.status === 'failed').length

  const sources = Array.from(new Set(call.provenance.map((item) => item.source)))
  const latestAt = call.provenance
    .map((item) => item.at)
    .sort()
    .at(-1)

  return (
    <Panel>
      <PanelHeader
        title="交易记录"
        subtitle="按时间倒序"
        aside={
          <>
            <StatLabel>返回条数</StatLabel>
            <StatValue>
              {payload.count}
              <span className="ml-1 text-[12px] font-normal text-ink-3">条</span>
            </StatValue>
            {failed > 0 ? <p className="mt-1 text-[11px] text-danger">其中 {failed} 条失败</p> : null}
          </>
        }
      />
      <ProvenanceStrip sources={sources} at={latestAt} scope={`${payload.count} 条`} />

      <ul className="sm:hidden">
        {rows.map((record) => (
          <li key={record.hash} className="border-t border-line-soft/70 px-4 py-3">
            <div className="flex items-baseline gap-2">
              <DirectionChip direction={record.direction} />
              <span className="text-[12px] text-ink-3">
                <Timestamp value={record.timestamp} />
              </span>
              <span className="inline-flex items-center gap-1 text-[11px]">
                <span
                  className={cn('size-1.5 rounded-full', record.status === 'ok' ? 'bg-ok' : 'bg-danger')}
                  aria-hidden
                />
                <span className={record.status === 'ok' ? 'text-ok' : 'text-danger'}>
                  {record.status === 'ok' ? '成功' : '失败'}
                </span>
              </span>
              <span className="num ml-auto whitespace-nowrap text-[13px] text-ink">
                {formatAmount(record.value)}
                <span className="ml-1 text-[11px] text-ink-4">BERA</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11.5px]">
              <Peer record={record} />
              <CopyAddress address={record.hash} head={6} tail={4} className="text-[10.5px] opacity-60" />
            </div>
          </li>
        ))}

        {rows.length === 0 ? (
          <li className="border-t border-line-soft/70 px-4 py-6 text-center text-ink-3">
            没有查到交易记录
          </li>
        ) : null}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-[13px] sm:min-w-[620px]">
          <thead>
            <tr className="text-[11px] tracking-wide text-ink-4 uppercase">
              <th scope="col" className="px-5 py-3 text-left font-normal">
                时间
              </th>
              <th scope="col" className="px-4 py-3 text-left font-normal">
                摘要
              </th>
              <th scope="col" className="px-4 py-3 text-left font-normal">
                状态
              </th>
              <th scope="col" className="px-5 py-3 text-right font-normal">
                区块
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr
                key={record.hash}
                className="border-t border-line-soft/70 transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-5 py-3 align-top text-ink-2">
                  <Timestamp value={record.timestamp} />
                  <span className="mt-0.5 block">
                    <CopyAddress address={record.hash} head={8} tail={6} className="text-[10.5px]" />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <DirectionChip direction={record.direction} />
                    <span className="num text-ink">
                      {formatAmount(record.value)}
                      <span className="ml-1 text-[11px] text-ink-4">BERA</span>
                    </span>
                    <Peer record={record} />
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        record.status === 'ok' ? 'bg-ok' : 'bg-danger',
                      )}
                      aria-hidden
                    />
                    <span className={record.status === 'ok' ? 'text-ok' : 'text-danger'}>
                      {record.status === 'ok' ? '成功' : '失败'}
                    </span>
                  </span>
                </td>
                <td className="num px-5 py-3 text-right whitespace-nowrap text-ink-3">
                  {formatBlock(record.block)}
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr className="border-t border-line-soft/70">
                <td colSpan={4} className="px-5 py-6 text-center text-ink-3">
                  没有查到交易记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-2.5 text-[11.5px] text-ink-4">
        <span className="num">
          已显示 {rows.length} 条 / 单次最多返回 {payload.limit} 条
        </span>
        {hidden > 0 || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="cursor-pointer text-ink-3 transition-colors hover:text-gold"
          >
            {expanded ? '收起' : `展开其余 ${hidden} 条`}
          </button>
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
