import { useState } from 'react'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { sourceLabel } from '../../lib/format'
import type { ProvenanceItem } from '../../types/api'

function formatArguments(args: Record<string, unknown>): string {
  const entries = Object.entries(args).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  )
  if (entries.length === 0) return '无参数'
  return entries
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ')
}

export function ExecutionDetail({
  name,
  args,
  provenance,
  elapsedMs,
  defaultOpen = false,
}: {
  name: string
  args: Record<string, unknown>
  provenance: ProvenanceItem[]
  elapsedMs?: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const seconds = elapsedMs === undefined ? undefined : (elapsedMs / 1000).toFixed(2)

  return (
    <div className="border-t border-line-soft bg-[#0f0f0e]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-5 py-2.5 text-left text-[12px] text-ink-3 transition-colors hover:text-ink"
      >
        {open ? (
          <UpOutlined className="text-[10px] text-ink-4" />
        ) : (
          <DownOutlined className="text-[10px] text-ink-4" />
        )}
        <span>执行详情</span>
        <span className="text-ink-4">1 次工具调用</span>
        {seconds ? (
          <span className="num text-ink-4">· {seconds}s</span>
        ) : null}
        <span className="ml-auto text-[11.5px] text-ink-4">{open ? '收起' : '展开'}</span>
      </button>

      {open ? (
        <div className="px-5 pb-3.5">
          <ul className="space-y-1.5">
            <li className="flex gap-2 text-[11.5px] leading-relaxed">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-gold" aria-hidden />
              <span className="num shrink-0 text-ink">{name}</span>
              <span className="num min-w-0 break-all text-ink-4">{formatArguments(args)}</span>
            </li>
          </ul>

          {provenance.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-ink-4">
              <span>数据来源</span>
              <span className="num text-ink-3">
                {provenance
                  .map((item) => `${sourceLabel(item.source)} · ${item.field}`)
                  .join(' | ')}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
