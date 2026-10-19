import { createConfig, http, injected } from 'wagmi'
import { defineChain } from 'viem'

export const berachain = defineChain({
  id: 80094,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.berachain.com'] },
  },
  blockExplorers: {
    default: { name: 'Berascan', url: 'https://berascan.com' },
  },
})

export const wagmiConfig = createConfig({
  chains: [berachain],
  connectors: [injected()],
  transports: {
    [berachain.id]: http(),
  },
})

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && 'ethereum' in window
}
