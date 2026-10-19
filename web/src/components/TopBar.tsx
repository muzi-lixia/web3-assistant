import { Button, Tooltip, message } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { BrandMark } from './BrandMark'
import { formatCountdown, shortAddress, sourceLabel } from '../lib/format'
import { useSessionCountdown } from '../hooks/useSessionCountdown'
import { cn } from '../lib/cn'

export function TopBar({
  address,
  displayAddress,
  tokenCount,
  lastSource,
  onOpenScope,
  onSignOut,
}: {
  address: string
  displayAddress: string
  tokenCount: number | null
  lastSource?: string
  onOpenScope: () => void
  onSignOut: () => void
}) {
  const { remainingMs, expired } = useSessionCountdown()
  const [messageApi, holder] = message.useMessage()
  const urgent = remainingMs > 0 && remainingMs < 5 * 60 * 1000

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(displayAddress)
      messageApi.success('会话地址已复制')
    } catch {
      messageApi.error('复制失败')
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-canvas/90 backdrop-blur-md">
      {holder}
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          <BrandMark size={24} />
          <span className="text-[13.5px] font-semibold tracking-tight text-ink">Berachain 助手</span>
          <span className="rounded-sm border border-line bg-panel px-1.5 py-0.5 text-[10px] leading-none text-ink-3">
            v1 只读
          </span>
        </div>

        <div className="hidden items-center gap-2 text-[11.5px] text-ink-4 md:flex">
          <span className="h-3 w-px bg-line" aria-hidden />
          <span>查询范围仅限当前登录钱包</span>
          <span aria-hidden>·</span>
          <span>
            会话剩余{' '}
            <span className={cn('num', urgent || expired ? 'text-warn' : 'text-ink-2')}>
              {expired ? '已失效' : formatCountdown(remainingMs)}
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip title={`${address}（会话地址来自服务端验签 JWT，不由前端传入）`}>
            <button
              type="button"
              onClick={copyAddress}
              className="num cursor-pointer rounded-[7px] border border-line bg-panel px-2 py-1 text-[11.5px] text-ink-2 transition-colors hover:border-gold/40 hover:text-ink"
            >
              {shortAddress(displayAddress, 6, 4)}
            </button>
          </Tooltip>

          <Button size="small" onClick={onOpenScope} className="!text-[11.5px]">
            Token 范围
            {tokenCount !== null ? (
              <span className="num ml-1 text-ink-3">· {tokenCount}</span>
            ) : null}
          </Button>

          <Tooltip title="取自最近一次查询的溯源信息">
            <span className="hidden items-center gap-1.5 rounded-[7px] border border-line bg-panel px-2 py-1 text-[11.5px] text-ink-3 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-ok" aria-hidden />
              {sourceLabel(lastSource ?? 'berachain-rpc')}
            </span>
          </Tooltip>

          <Button
            size="small"
            type="text"
            onClick={onSignOut}
            icon={<LogoutOutlined />}
            aria-label="退出登录"
            className="!text-[11.5px] !text-ink-3 hover:!text-ink"
          >
            <span className="hidden sm:inline">退出</span>
          </Button>
        </div>

        <div className="flex w-full items-center gap-1.5 text-[11px] text-ink-4 md:hidden">
          <span>查询范围仅限当前登录钱包</span>
          <span aria-hidden>·</span>
          <span>
            会话剩余{' '}
            <span className={cn('num', urgent || expired ? 'text-warn' : 'text-ink-2')}>
              {expired ? '已失效' : formatCountdown(remainingMs)}
            </span>
          </span>
        </div>
      </div>
    </header>
  )
}
