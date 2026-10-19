import {
  CommentOutlined,
  DatabaseOutlined,
  FilterOutlined,
  LockOutlined,
  QuestionCircleOutlined,
  SlidersOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import { BrandMark } from './BrandMark'
import { cn } from '../lib/cn'

export type NavKey =
  | 'agent'
  | 'assets'
  | 'transactions'
  | 'staking'
  | 'scope'
  | 'sources'
  | 'help'

interface NavItem {
  key: NavKey
  label: string
  icon: ReactNode
}

const WORKSPACE: NavItem[] = [
  { key: 'agent', label: 'Agent 助手', icon: <CommentOutlined /> },
  { key: 'assets', label: '资产总览', icon: <DatabaseOutlined /> },
  { key: 'transactions', label: '交易记录', icon: <SwapOutlined /> },
  { key: 'staking', label: '质押与解锁', icon: <LockOutlined /> },
]

const CONFIG: NavItem[] = [
  { key: 'scope', label: 'Token 范围', icon: <SlidersOutlined /> },
  { key: 'sources', label: '数据源与溯源', icon: <FilterOutlined /> },
  { key: 'help', label: '使用说明', icon: <QuestionCircleOutlined /> },
]

function Group({
  label,
  items,
  active,
  onSelect,
  className,
}: {
  label: string
  items: NavItem[]
  active: NavKey
  onSelect: (key: NavKey) => void
  className?: string
}) {
  return (
    <div className={className}>
      <p className="px-2.5 pt-2 pb-1.5 text-[11px] leading-none text-ink-4">{label}</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = item.key === active
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] transition-colors',
                  isActive
                    ? 'bg-[#211f1b] text-ink'
                    : 'text-ink-2 hover:bg-white/[0.03] hover:text-ink',
                )}
              >
                <span className={cn('text-[15px] leading-none', isActive ? 'text-gold' : 'text-ink-3')}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Sidebar({
  active,
  onSelect,
  className,
}: {
  active: NavKey
  onSelect: (key: NavKey) => void
  className?: string
}) {
  return (
    <aside
      className={cn(
        'w-[260px] shrink-0 flex-col border-r border-line-soft bg-canvas',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <BrandMark size={34} />
        <div className="min-w-0">
          <p className="truncate text-[14px] leading-tight font-semibold text-ink">Berachain 助手</p>
          <p className="mt-1 text-[10.5px] leading-none text-ink-4">全局导航 · v1 只读</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <Group label="工作台" items={WORKSPACE} active={active} onSelect={onSelect} />
        <Group label="配置" items={CONFIG} active={active} onSelect={onSelect} className="mt-3" />
      </nav>

      <div className="flex items-center gap-1.5 px-4 py-4 text-[10.5px] text-ink-4">
        <span className="size-1.5 shrink-0 rounded-full bg-ok" aria-hidden />
        Berachain Mainnet · 80094
      </div>
    </aside>
  )
}
