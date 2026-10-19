import { Drawer, Grid } from 'antd'
import { CloseOutlined } from '@ant-design/icons'

export type InfoKind = 'sources' | 'help'

const SOURCES = [
  {
    name: '链上 RPC',
    detail: 'Berachain Mainnet 80094',
    fields: '余额、sWBERA 持仓、解锁请求、区块高度与区块时间',
  },
  {
    name: 'DeFiLlama',
    detail: '价格源',
    fields: 'WBERA 单价；sWBERA 单价按链上兑换率折算',
  },
  {
    name: 'Etherscan v2',
    detail: 'Browser API',
    fields: '当前地址的最近交易记录',
  },
]

const RULES = [
  '每条答案都附「字段 / 数据源 / 取数时点」，没有溯源的数字不输出。',
  '估值与链上数据分列：报价失败不影响余额返回，缺价项标注「暂不可用」，不按 0 计入合计。',
  '解锁是否到期以链上区块时间为准，不用本地时钟推断。',
  '取不到数据时明确说明原因，不用空结果冒充「没有数据」。',
]

const QUESTIONS = [
  { ask: '我钱包里现在有什么', answer: '范围内 token 的余额与合计估值' },
  { ask: '最近都发生了什么', answer: '最近交易记录，含成功 / 失败状态' },
  { ask: '我的质押什么时候能取出来', answer: '持仓、在押份额、解锁排队三部分分列' },
]

const LIMITS = [
  'v1 全程只读：不发起交易、不存私钥、不持有可动用资金的凭据。',
  '只查当前登录钱包地址，指定其他地址的提问会被拒绝。',
  '交易记录单次最多返回 20 条，更早的记录无法获取，边界会明确告知。',
  '不提供按时间窗筛选，也不分页调取历史。',
  '不展示收益率数值：各来源口径差异大，避免误导。',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-[11px] tracking-wide text-ink-4">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

export function InfoDrawer({
  kind,
  onClose,
}: {
  kind: InfoKind | null
  onClose: () => void
}) {
  const screens = Grid.useBreakpoint()

  return (
    <Drawer
      open={kind !== null}
      onClose={onClose}
      placement="right"
      size={screens.md ? 400 : '100%'}
      closable={false}
      title={
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-ink">
              {kind === 'help' ? '使用说明' : '数据源与溯源'}
            </div>
            <p className="mt-1 text-[11.5px] font-normal text-ink-4">
              {kind === 'help'
                ? 'v1 只读查询能做什么、不能做什么'
                : '每个数字来自哪里、什么时候取的'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭面板"
            className="-mr-1 cursor-pointer rounded-[6px] p-1.5 text-ink-3 transition-colors hover:bg-panel-raised hover:text-ink"
          >
            <CloseOutlined />
          </button>
        </div>
      }
      styles={{ body: { padding: '16px 20px 24px' } }}
    >
      {kind === 'sources' ? (
        <>
          <Section title="当前使用的数据源">
            <ul className="space-y-2.5">
              {SOURCES.map((source) => (
                <li key={source.name} className="rounded-[10px] border border-line bg-panel px-3 py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12.5px] font-medium text-ink">{source.name}</span>
                    <span className="text-[11px] text-ink-4">{source.detail}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{source.fields}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="溯源规则">
            <ul className="space-y-2">
              {RULES.map((rule) => (
                <li key={rule} className="flex gap-2 text-[12px] leading-relaxed text-ink-3">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-gold" aria-hidden />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : (
        <>
          <Section title="可以直接这样问">
            <ul className="space-y-2.5">
              {QUESTIONS.map((item) => (
                <li key={item.ask} className="rounded-[10px] border border-line bg-panel px-3 py-2.5">
                  <p className="text-[12.5px] text-ink">「{item.ask}」</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{item.answer}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="边界">
            <ul className="space-y-2">
              {LIMITS.map((limit) => (
                <li key={limit} className="flex gap-2 text-[12px] leading-relaxed text-ink-3">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-4" aria-hidden />
                  <span>{limit}</span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </Drawer>
  )
}
