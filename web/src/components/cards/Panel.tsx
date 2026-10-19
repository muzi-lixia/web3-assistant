import type { ReactNode } from 'react'
import { Tooltip, message } from 'antd'
import { cn } from '../../lib/cn'
import { formatBlock, formatClock, shortAddress, sourceLabel } from '../../lib/format'

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[14px] border border-line bg-[#0f0f0e] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  title,
  subtitle,
  aside,
  tags,
}: {
  title: string
  subtitle?: ReactNode
  aside?: ReactNode
  tags?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
          {tags}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-ink-3">{subtitle}</p> : null}
      </div>
      {aside ? <div className="ml-auto text-right">{aside}</div> : null}
    </header>
  )
}

export function ProvenanceStrip({
  sources,
  block,
  at,
  scope,
  note,
}: {
  sources: string[]
  block?: number
  at?: string
  scope?: string
  note?: string
}) {
  const cells: Array<{ label: string; value: string; mono?: boolean }> = []

  if (sources.length > 0) {
    cells.push({ label: '数据源', value: sources.map(sourceLabel).join(' · ') })
  }
  if (block !== undefined) {
    cells.push({ label: '区块', value: formatBlock(block), mono: true })
  }
  if (at) {
    cells.push({ label: '统计时间', value: formatClock(at), mono: true })
  }
  if (scope) {
    cells.push({ label: '范围', value: scope })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft bg-[#0b0b0a] px-4 py-2 text-[11px] text-ink-3 sm:px-5">
      {cells.map((cell) => (
        <span key={cell.label} className="whitespace-nowrap">
          <span className="text-ink-4">{cell.label}</span>{' '}
          <span className={cn('text-ink-2', cell.mono && 'num')}>{cell.value}</span>
        </span>
      ))}
      {note ? <span className="text-ink-3">{note}</span> : null}
    </div>
  )
}

export function CopyAddress({
  address,
  head = 6,
  tail = 4,
  className,
}: {
  address: string
  head?: number
  tail?: number
  className?: string
}) {
  const [messageApi, holder] = message.useMessage()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      messageApi.success('地址已复制')
    } catch {
      messageApi.error('复制失败，请手动选择地址')
    }
  }

  return (
    <>
      {holder}
      <Tooltip title={`${address}（点击复制）`}>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'num cursor-pointer rounded-sm text-ink-3 transition-colors hover:text-gold',
            className,
          )}
          aria-label={`复制地址 ${address}`}
        >
          {shortAddress(address, head, tail)}
        </button>
      </Tooltip>
    </>
  )
}

export function StatValue({
  children,
  muted,
}: {
  children: ReactNode
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        'num text-[26px] leading-tight font-medium tracking-tight',
        muted ? 'text-ink-4' : 'text-ink',
      )}
    >
      {children}
    </div>
  )
}

export function StatLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] tracking-wide text-ink-3 uppercase">{children}</div>
  )
}
