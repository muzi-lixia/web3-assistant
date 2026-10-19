import { useCallback, useEffect, useRef } from 'react'
import type { ChatMessage } from '../hooks/useChat'
import { AssistantMessage } from './AssistantMessage'
import { formatClock } from '../lib/format'

const SAMPLE_PROMPTS = [
  '我钱包里现在有什么',
  '最近都发生了什么',
  '我的质押什么时候能取出来',
]

function UserBubble({ text, at }: { text: string; at: number }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-[7px] border border-line bg-panel text-[10.5px] text-ink-3">
        你
      </span>
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-[11.5px]">
          <span className="text-ink-3">你</span>
          <span className="num text-ink-4">{formatClock(new Date(at).toISOString())}</span>
        </div>
        <p className="inline-block max-w-[62ch] rounded-[10px] rounded-tl-[3px] border border-line bg-[#14140f] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
          {text}
        </p>
      </div>
    </div>
  )
}

export function ChatThread({
  messages,
  isStreaming,
  onRetry,
  onPick,
}: {
  messages: ChatMessage[]
  isStreaming: boolean
  onRetry: (text: string) => void
  onPick: (text: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)

  const handleScroll = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    nearBottomRef.current = distance < 140
  }, [])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node || !nearBottomRef.current) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-contain px-4 pt-6 pb-4 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7">
        {messages.length === 0 ? (
          <div className="pt-6 sm:pt-14">
            <p className="text-[11px] tracking-[0.14em] text-ink-4 uppercase">v1 只读查询</p>
            <h1 className="mt-3 max-w-[18ch] text-[26px] leading-[1.3] font-semibold tracking-tight text-ink sm:text-[34px]">
              用自然语言一步拿到你的链上资产、交易与质押
            </h1>
            <p className="mt-3 max-w-[56ch] text-[13px] leading-relaxed text-ink-3">
              签名登录后自动绑定当前钱包地址；每条答案都标明数据源、统计区块与时间。
              不需要知道合约地址，也不必看懂区块浏览器。
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onPick(prompt)}
                  className="cursor-pointer rounded-full border border-line bg-panel px-3.5 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-gold/40 hover:text-ink"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => {
          if (message.role === 'user') {
            return <UserBubble key={message.id} text={message.text} at={message.at} />
          }

          const previous = messages
            .slice(0, index)
            .reverse()
            .find((item): item is Extract<ChatMessage, { role: 'user' }> => item.role === 'user')

          return (
            <AssistantMessage
              key={message.id}
              message={message}
              retryText={previous?.text}
              onRetry={onRetry}
              busy={isStreaming}
            />
          )
        })}
      </div>
    </div>
  )
}
