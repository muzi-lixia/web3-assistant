import { Button, Tooltip, message } from 'antd'
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons'
import { formatCountdown, shortAddress, sourceLabel } from '../lib/format'
import { useSessionCountdown } from '../hooks/useSessionCountdown'
import { cn } from '../lib/cn'

export function TopBar({
  address,
  displayAddress,
  tokenCount,
  lastSource,
  onOpenScope,
  onOpenNav,
  onSignOut,
}: {
  address: string
  displayAddress: string
  tokenCount: number | null
  lastSource?: string
  onOpenScope: () => void
  onOpenNav: () => void
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
    <header className="sticky top-0 z-20 border-b border-line-soft bg-canvas-soft/95 backdrop-blur-md">
      {holder}
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="打开导航"
          className="-ml-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-[7px] text-ink-2 transition-colors hover:bg-panel-raised hover:text-ink lg:hidden"
        >
          <MenuOutlined />
        </button>

        <div className="min-w-0">
          <h1 className="text-[15px] leading-tight font-semibold tracking-tight text-ink">对话查询</h1>
          <p className="mt-1 truncate text-[11.5px] leading-none text-ink-4">
            查询范围：仅限当前登录钱包
            <span className="mx-1.5 text-line" aria-hidden>
              ·
            </span>
            会话剩余{' '}
            <span className={cn('num', urgent || expired ? 'text-warn' : 'text-ink-2')}>
              {expired ? '已失效' : formatCountdown(remainingMs)}
            </span>
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Tooltip title={`${address}（会话地址来自服务端验签 JWT，不由前端传入）`}>
            <button
              type="button"
              onClick={copyAddress}
              className="num cursor-pointer rounded-[7px] border border-line bg-panel px-2.5 py-1 text-[11.5px] text-ink-2 transition-colors hover:border-gold/40 hover:text-ink"
            >
              {shortAddress(displayAddress, 6, 4)}
            </button>
          </Tooltip>

          <button
            type="button"
            onClick={onOpenScope}
            className="hidden cursor-pointer rounded-[7px] border border-line bg-panel px-2.5 py-1 text-[11.5px] text-ink-2 transition-colors hover:border-gold/40 hover:text-ink sm:block"
          >
            Token 范围
            {tokenCount !== null ? <span className="num ml-1 text-ink-3">· {tokenCount} 项</span> : null}
          </button>

          <Tooltip title="取自最近一次查询的溯源信息">
            <span className="hidden items-center gap-1.5 rounded-[7px] border border-line bg-panel px-2.5 py-1 text-[11.5px] text-ink-3 md:inline-flex">
              <span className="size-1.5 rounded-full bg-ok" aria-hidden />
              {sourceLabel(lastSource ?? 'berachain-rpc')}
              <span className="text-[10.5px] text-ink-4">主</span>
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
      </div>
    </header>
  )
}
