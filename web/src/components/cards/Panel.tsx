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
        'overflow-hidden rounded-[14px] border border-line bg-[#121210] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]',
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
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[17px] leading-tight font-semibold tracking-tight text-ink">{title}</h3>
        {tags}
        {subtitle ? <p className="text-[12px] text-ink-4">{subtitle}</p> : null}
      </div>
      {aside ? <div className="ml-auto shrink-0 text-right">{aside}</div> : null}
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-y border-line-soft bg-[#0d0d0c] px-5 py-2.5 text-[11.5px] text-ink-3">
      <span className="h-3 w-px shrink-0 bg-gold/60" aria-hidden />
      {cells.map((cell) => (
        <span key={cell.label} className="whitespace-nowrap">
          <span className="text-ink-4">{cell.label} </span>
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
        'num text-[26px] leading-[1.15] font-medium tracking-tight',
        muted ? 'text-ink-4' : 'text-ink',
      )}
    >
      {children}
    </div>
  )
}

export function StatLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] tracking-wide text-ink-4">{children}</div>
}
