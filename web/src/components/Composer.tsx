import { useCallback, useRef, useState } from 'react'
import { Input } from 'antd'
import { ArrowUpOutlined } from '@ant-design/icons'
import { cn } from '../lib/cn'

const QUICK_PROMPTS = ['我钱包里现在有什么', '最近都发生了什么', '我的质押什么时候能取出来']

export function Composer({
  onSend,
  onStop,
  isStreaming,
}: {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
}) {
  const [value, setValue] = useState('')
  const composingRef = useRef(false)

  const submit = useCallback(() => {
    const text = value.trim()
    if (!text || isStreaming) return
    setValue('')
    onSend(text)
  }, [isStreaming, onSend, value])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent as KeyboardEvent
    if (event.key !== 'Enter' || event.shiftKey) return
    if (native.isComposing || composingRef.current) return
    event.preventDefault()
    submit()
  }

  return (
    <div className="border-t border-line-soft bg-canvas">
      <div className="mx-auto w-full max-w-[880px] px-4 py-3 sm:px-6">
        <div
          className={cn(
            'flex items-end gap-2 rounded-[14px] border bg-[#0f0f0e] px-3 py-2 transition-colors',
            isStreaming ? 'border-line' : 'border-line focus-within:border-gold/45',
          )}
        >
          <label htmlFor="composer" className="sr-only">
            向助手提问
          </label>
          <Input.TextArea
            id="composer"
            variant="borderless"
            autoSize={{ minRows: 1, maxRows: 5 }}
            value={value}
            placeholder="问关于你的资产、交易或质押情况…"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            className="!px-1 !py-1.5 !text-[13.5px] !leading-relaxed"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="停止本次查询"
              className="mb-0.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-panel text-ink-2 transition-colors hover:border-danger/50 hover:text-danger"
            >
              <span className="block size-2.5 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="发送"
              className={cn(
                'mb-0.5 grid size-9 shrink-0 place-items-center rounded-full transition-all',
                value.trim()
                  ? 'cursor-pointer bg-gold text-[#241c07] hover:bg-[#f0cf7a]'
                  : 'cursor-not-allowed border border-line bg-panel text-ink-4',
              )}
            >
              <ArrowUpOutlined />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                if (isStreaming) return
                setValue('')
                onSend(prompt)
              }}
              disabled={isStreaming}
              className="cursor-pointer border-b border-dashed border-line pb-0.5 text-[11.5px] text-ink-3 transition-colors hover:border-gold/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-ink-4">
          Enter 发送 · Shift+Enter 换行 · 所有答案均附数据源与统计时点，不可溯源的数据不输出
        </p>
      </div>
    </div>
  )
}
