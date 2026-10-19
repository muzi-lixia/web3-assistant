import { useMemo, useState } from 'react'
import { Button, DatePicker, Segmented } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { cn } from '../../lib/cn'
import { formatBlock, formatDateTime } from '../../lib/format'
import type { TxPayload, TxRecordDto, TxStatus } from '../../types/api'
import { Panel, PanelHeader, StatLabel, StatValue } from './Panel'

const PAGE_SIZE = 10
const MAX_RETURN = 50

const STATUS_META: Record<TxStatus, { label: string; dot: string; text: string }> = {
  success: { label: '成功', dot: 'bg-ok', text: 'text-ok' },
  pending: { label: '待确认', dot: 'bg-warn', text: 'text-warn' },
  failed: { label: '失败', dot: 'bg-danger', text: 'text-danger' },
}

type RangeValue = 7 | 30 | 90 | 'custom'

function recordTime(record: TxRecordDto, now: number): Dayjs {
  return dayjs(now - record.hoursAgo * 3600 * 1000)
}

export function TxCard({ payload }: { payload: TxPayload }) {
  const [range, setRange] = useState<RangeValue>(30)
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)

  const now = useMemo(() => Date.now(), [])

  const filtered = useMemo(() => {
    if (range === 'custom') {
      if (!custom) return payload.records
      const [start, end] = custom
      return payload.records.filter((record) => {
        const at = recordTime(record, now)
        return !at.isBefore(start, 'day') && !at.isAfter(end, 'day')
      })
    }
    const limitHours = range * 24
    return payload.records.filter((record) => record.hoursAgo <= limitHours)
  }, [custom, now, payload.records, range])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pageRecords = filtered.slice(startIndex, startIndex + PAGE_SIZE)

  const counts = useMemo(() => {
    const base: Record<string, number> = { 普通: 0, 内部: 0, 'ERC-20': 0 }
    for (const record of filtered) base[record.kind] = (base[record.kind] ?? 0) + 1
    return base
  }, [filtered])

  const rangeLabel =
    range === 'custom'
      ? custom
        ? `${custom[0].format('MM-DD')} → ${custom[1].format('MM-DD')}`
        : '自定义'
      : `最近 ${range} 天`

  return (
    <Panel>
      <PanelHeader
        title="交易记录"
        subtitle={`${rangeLabel} · 三类记录合并按时间倒序`}
        tags={
          <span className="rounded-sm border border-warn/40 bg-warn/[0.08] px-1.5 py-0.5 text-[10px] leading-none text-warn">
            示例数据
          </span>
        }
        aside={
          <>
            <StatLabel>返回条数</StatLabel>
            <StatValue>
              {filtered.length}
              <span className="ml-1 text-[12px] font-normal text-ink-3">条</span>
            </StatValue>
            <p className="num mt-1 text-[11px] text-ink-4">
              普通 {counts['普通'] ?? 0} · 内部 {counts['内部'] ?? 0} · ERC-20 {counts['ERC-20'] ?? 0}
            </p>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
        <Segmented<RangeValue>
          size="small"
          value={range}
          onChange={(value) => {
            setRange(value)
            setPage(1)
          }}
          options={[
            { label: '7 天', value: 7 },
            { label: '30 天', value: 30 },
            { label: '90 天', value: 90 },
            { label: '自定义', value: 'custom' },
          ]}
        />
        {range === 'custom' ? (
          <DatePicker.RangePicker
            size="small"
            value={custom}
            allowClear
            placeholder={['开始日期', '结束日期']}
            onChange={(value) => {
              setCustom(value && value[0] && value[1] ? [value[0], value[1]] : null)
              setPage(1)
            }}
          />
        ) : null}
        <span className="ml-auto text-[11px] text-ink-4">
          数据源深度 {payload.depthDays} 天
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] sm:min-w-[680px]">
          <thead>
            <tr className="text-[11px] tracking-wide text-ink-4 uppercase">
              <th scope="col" className="px-4 py-2.5 text-left font-normal sm:px-5">
                时间
              </th>
              <th scope="col" className="hidden px-4 py-2.5 text-left font-normal sm:table-cell">
                类型
              </th>
              <th scope="col" className="px-4 py-2.5 text-left font-normal">
                摘要
              </th>
              <th scope="col" className="px-4 py-2.5 text-left font-normal">
                状态
              </th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-normal sm:table-cell sm:px-5">
                区块
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRecords.map((record) => {
              const meta = STATUS_META[record.status]
              return (
                <tr
                  key={record.id}
                  className="border-t border-line-soft/70 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="num px-4 py-3 whitespace-nowrap text-ink-2 sm:px-5">
                    {formatDateTime(recordTime(record, now).toISOString())}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-ink-3 sm:table-cell">
                    {record.kind}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {record.summary}
                    <span className="num mt-0.5 block text-[10.5px] text-ink-4 sm:hidden">
                      {record.kind} · {record.block ? formatBlock(record.block) : '待打包'}
                    </span>
                    {record.reason ? (
                      <span className="mt-0.5 block text-[11px] text-danger">
                        失败原因：{record.reason}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
                      <span className={meta.text}>{meta.label}</span>
                    </span>
                  </td>
                  <td className="num hidden px-4 py-3 text-right whitespace-nowrap text-ink-3 sm:table-cell sm:px-5">
                    {record.block ? formatBlock(record.block) : '待打包'}
                  </td>
                </tr>
              )
            })}

            {pageRecords.length === 0 ? (
              <tr className="border-t border-line-soft/70">
                <td colSpan={5} className="px-4 py-6 text-center text-ink-3 sm:px-5">
                  所选时间范围内没有记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line-soft bg-warn/[0.06] px-4 py-2 text-[11.5px] leading-relaxed text-warn sm:px-5">
        {payload.depthDays} 天以前的数据无法获取，这不是「没有记录」，而是超出数据源可查深度
      </p>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-2.5 text-[11.5px] text-ink-4 sm:px-5">
        <span className="num">
          第 {filtered.length === 0 ? 0 : startIndex + 1}–
          {Math.min(startIndex + PAGE_SIZE, filtered.length)} 条 · 单次最多返回 {MAX_RETURN} 条
        </span>
        <span className="flex items-center gap-1">
          <Button
            size="small"
            type="text"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            上一页
          </Button>
          <Button
            size="small"
            type="text"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            下一页
          </Button>
        </span>
      </footer>
    </Panel>
  )
}
