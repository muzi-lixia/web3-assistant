import { useState } from 'react'
import { Button, Input, Modal } from 'antd'
import {
  FileSearchOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { BrandMark } from '../components/BrandMark'
import { PHASE_LABELS, useLogin } from '../hooks/useLogin'
import { useSessionStore } from '../store/session'
import { berachain } from '../lib/wagmi'
import { shortAddress } from '../lib/format'
import { cn } from '../lib/cn'

const FEATURES = [
  { icon: <WalletOutlined />, title: '资产查询', desc: '范围内 token 的余额与合计估值' },
  { icon: <HistoryOutlined />, title: '交易记录', desc: '普通 / 内部 / ERC-20 转账，含状态与可查深度边界提示' },
  { icon: <SafetyCertificateOutlined />, title: '质押情况', desc: 'sWBERA 持仓、Vault 在押、解锁排队三部分分列' },
  { icon: <FileSearchOutlined />, title: '答案溯源', desc: '数据源、统计区块与时间随答案一并返回，不可溯源的数据不输出' },
]

const CAPABILITIES = [
  '资产查询：范围内 token 的余额、估值与合计，标注区块高度与估值来源',
  '交易记录：普通交易、内部交易、ERC-20 转账合并按时间倒序，含成功 / 失败 / 待确认',
  '质押查询：sWBERA 持仓、Vault 在押份额、解锁排队份额，三部分不合并',
  '答案溯源：每条含链上数据的答案都附数据源、统计区块与时点',
]

export function LoginPage() {
  const {
    phase,
    error,
    nonceNotice,
    address,
    isConnected,
    connectedChainId,
    connect,
    signInWithWallet,
    reset,
  } = useLogin()
  const expiredNotice = useSessionStore((state) => state.expiredNotice)
  const dismissNotice = useSessionStore((state) => state.dismissNotice)
  const [capabilityOpen, setCapabilityOpen] = useState(false)

  const busy = phase === 'connecting' || phase === 'requesting-nonce' || phase === 'awaiting-signature' || phase === 'verifying'
  const wrongChain = isConnected && connectedChainId !== berachain.id

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto grid min-h-dvh w-full max-w-[1180px] items-center gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-16">
        <section className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="text-[13.5px] font-semibold text-ink">Berachain 助手</span>
            <span className="rounded-sm border border-line bg-panel px-1.5 py-0.5 text-[10px] leading-none text-ink-3">
              v1 只读
            </span>
          </div>

          <h1 className="mt-8 text-[30px] leading-[1.28] font-semibold tracking-tight text-ink sm:text-[40px]">
            用自然语言一步拿到
            <br />
            你的链上资产、交易与质押
          </h1>

          <p className="mt-4 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-3">
            签名登录后，查询自动绑定当前钱包地址；每条答案都标明数据源、统计区块与时间。
            无需知道合约地址，也不必看懂区块浏览器。
          </p>

          <ul className="mt-9 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] border border-line bg-panel text-[13px] text-ink-2">
                  {feature.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{feature.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-4">
                    {feature.desc}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-auto pt-10 text-[11px] leading-relaxed text-ink-4">
            v1 全程只读 · 不存储私钥 · 不发起签名以外的任何请求 · 不支持查询他人地址 · 仅支持 Berachain
            Mainnet 80094
          </p>
        </section>

        <section className="flex flex-col gap-4 lg:pt-2">
          {expiredNotice ? (
            <div className="flex items-start justify-between gap-3 rounded-[10px] border border-warn/30 bg-warn/[0.07] px-3.5 py-2.5">
              <p className="text-[12px] leading-relaxed text-warn">
                会话已失效，请重新签名登录。失效期间的查询一律拒绝，不会使用残留地址。
              </p>
              <button
                type="button"
                onClick={dismissNotice}
                className="shrink-0 cursor-pointer text-[11px] text-ink-3 hover:text-ink"
              >
                知道了
              </button>
            </div>
          ) : null}

          <div className="rounded-[16px] border border-line bg-[#0f0f0e] p-5 sm:p-6">
            <h2 className="text-[14px] font-semibold text-ink">连接钱包</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
              用 EVM 钱包对服务端下发的一次性消息签名，服务端验签后签发 JWT 建立会话（SIWE 类流程）。
            </p>

            <div className="mt-5">
              <span className="text-[11px] tracking-wide text-ink-4 uppercase">会话地址</span>
              <Input
                readOnly
                value={isConnected && address ? shortAddress(address, 10, 8) : ''}
                placeholder="尚未建立会话 · 验签成功后绑定"
                className="num mt-1.5 !cursor-default !bg-[#0b0b0a] !text-[12.5px]"
              />
              <p className="mt-1.5 text-[11px] text-ink-4">
                地址仅用于发起签名请求；会话地址以服务端验签结果为准，前端传入的地址不采信。
              </p>
            </div>

            {wrongChain ? (
              <p className="mt-3 rounded-[8px] border border-warn/25 bg-warn/[0.06] px-2.5 py-2 text-[11.5px] text-warn">
                当前网络不是 Berachain Mainnet（{berachain.id}），签名前会请求切换网络。
              </p>
            ) : null}

            <div className="mt-5 space-y-2.5">
              {isConnected ? (
                <Button
                  type="primary"
                  block
                  size="large"
                  loading={busy}
                  onClick={signInWithWallet}
                >
                  {busy ? PHASE_LABELS[phase] : '签名登录'}
                </Button>
              ) : (
                <Button type="primary" block size="large" loading={busy} onClick={connect}>
                  {busy ? PHASE_LABELS[phase] : '连接钱包'}
                </Button>
              )}

              <Button block size="large" onClick={() => setCapabilityOpen(true)}>
                查看能力清单
              </Button>
            </div>

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-[8px] border border-danger/30 bg-danger/[0.06] px-3 py-2.5">
                <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-danger" role="alert">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="shrink-0 cursor-pointer text-[11px] text-ink-3 hover:text-ink"
                >
                  重置
                </button>
              </div>
            ) : null}

            <p className="mt-4 text-[11px] leading-relaxed text-ink-4">
              支持浏览器插件钱包与 WalletConnect 扫码（手机钱包）。nonce 一次性有效（5 分钟），
              验签失败或 nonce 失效时不会降级为匿名会话，需要重新发起登录。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={cn(
                'rounded-[10px] border px-3.5 py-3',
                isConnected ? 'border-gold/35 bg-gold/[0.05]' : 'border-line bg-panel/60',
              )}
            >
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium">
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    isConnected ? 'bg-gold' : 'bg-ink-4',
                  )}
                  aria-hidden
                />
                <span className={isConnected ? 'text-gold' : 'text-ink-2'}>等待钱包签名</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                已下发 nonce 并推送签名请求，等待钱包确认。
              </p>
            </div>

            <div
              className={cn(
                'rounded-[10px] border px-3.5 py-3',
                nonceNotice ? 'border-danger/30 bg-danger/[0.05]' : 'border-line bg-panel/60',
              )}
            >
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium">
                <span
                  className={cn('size-1.5 rounded-full', nonceNotice ? 'bg-danger' : 'bg-ink-4')}
                  aria-hidden
                />
                <span className={nonceNotice ? 'text-danger' : 'text-ink-2'}>nonce 已失效</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                {nonceNotice ?? '一次性有效 5 分钟，不签发 JWT，也不会降级为匿名会话。'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={capabilityOpen}
        onCancel={() => setCapabilityOpen(false)}
        footer={null}
        title="当前可查询的能力"
        centered
      >
        <ul className="space-y-2.5">
          {CAPABILITIES.map((item) => (
            <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-gold" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-4">
          v1 只做查询，不发起任何交易或签名以外的写操作。
        </p>
      </Modal>
    </div>
  )
}
