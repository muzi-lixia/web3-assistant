import { useCallback, useRef, useState } from 'react'
import { Input } from 'antd'
import { ArrowUpOutlined } from '@ant-design/icons'
import { cn } from '../lib/cn'

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
    <div className="border-t border-line-soft bg-canvas-soft">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-3.5 sm:px-8 xl:px-16">
        <div
          className={cn(
            'flex items-end gap-2 rounded-[14px] border bg-[#121110] py-1.5 pr-2 pl-3.5 transition-colors',
            isStreaming ? 'border-line' : 'border-line/80 focus-within:border-gold/45',
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
            placeholder="问我关于你的资产、交易或质押情况…"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            className="!px-0 !py-2 !text-[13.5px] !leading-relaxed"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="停止本次查询"
              className="mb-0.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-panel text-ink-2 transition-colors hover:border-danger/50 hover:text-danger"
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
                'mb-0.5 grid size-8 shrink-0 place-items-center rounded-full transition-all',
                value.trim()
                  ? 'cursor-pointer bg-gold text-[#241c07] hover:bg-[#f0cf7a]'
                  : 'cursor-not-allowed border border-line bg-panel text-ink-4',
              )}
            >
              <ArrowUpOutlined />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
