import { Button } from 'antd'
import type { ChatErrorPayload } from '../types/api'
import { cn } from '../lib/cn'

const COPY: Record<string, { title: string; hint: string; tone: 'warn' | 'danger' }> = {
  address_rejected: {
    title: '越权查询已拒绝',
    hint: '仅支持查询当前登录钱包对应的地址，不执行其他地址的任何查询。',
    tone: 'warn',
  },
  intent_unrecognized: {
    title: '意图未明',
    hint: '当前可查询：资产余额 / 交易记录 / 质押情况。请明确想查哪一项。',
    tone: 'warn',
  },
  datasource_unavailable: {
    title: '数据源故障',
    hint: '未返回任何数据，避免把「取不到」显示成「没有」。',
    tone: 'danger',
  },
  datasource_timeout: {
    title: '数据源超时',
    hint: '本次未返回部分数据，不做静默截断。',
    tone: 'danger',
  },
  rate_limited: {
    title: '请求过于频繁',
    hint: '数据源限流命中，稍后重试即可。',
    tone: 'warn',
  },
  internal_error: {
    title: '服务异常',
    hint: '服务端内部错误，与查询条件无关。',
    tone: 'danger',
  },
  network_error: {
    title: '网络异常',
    hint: '与浏览器或代理的连接中断。',
    tone: 'danger',
  },
}

export function ErrorNotice({
  error,
  onRetry,
  disabled,
}: {
  error: ChatErrorPayload
  onRetry?: () => void
  disabled?: boolean
}) {
  const meta = COPY[error.code] ?? {
    title: '查询失败',
    hint: '未返回完整结果。',
    tone: 'danger' as const,
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-[10px] border px-3.5 py-3',
        meta.tone === 'warn'
          ? 'border-warn/30 bg-warn/[0.06]'
          : 'border-danger/30 bg-danger/[0.06]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'text-[12.5px] font-medium',
            meta.tone === 'warn' ? 'text-warn' : 'text-danger',
          )}
        >
          {meta.title}
        </span>
        <span className="num text-[10.5px] tracking-wide text-ink-4">{error.code}</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{error.message}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-4">{meta.hint}</p>
      {error.retryable && onRetry ? (
        <Button size="small" className="mt-2.5" onClick={onRetry} disabled={disabled}>
          重试
        </Button>
      ) : null}
    </div>
  )
}
