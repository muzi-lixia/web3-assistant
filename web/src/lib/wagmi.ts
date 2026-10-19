import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { berachain } from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'

/**
 * 钱包连接配置：Reown AppKit（WalletConnect 扫码 / 浏览器插件 / 移动端）+
 * wagmi 适配层。下游的 useConnection / useSignMessage 用法与原先一致。
 */
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error(
    '缺少 VITE_REOWN_PROJECT_ID：把 web/.env.example 复制为 web/.env 并填入 projectId（在 https://cloud.reown.com 免费创建）。',
  )
}

/** 只支持 Berachain Mainnet 80094，产品内不做多链查询 */
const networks = [berachain] as [AppKitNetwork, ...AppKitNetwork[]]

const wagmiAdapter = new WagmiAdapter({ projectId, networks })

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'Berachain 助手',
    description: '用自然语言查链上资产、交易与质押',
    url: window.location.origin,
    icons: [],
  },
  features: {
    analytics: false,
    // 只做钱包登录：邮箱 / 社交登录会产生与链上地址无关的身份
    email: false,
    socials: false,
  },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
export { berachain }
