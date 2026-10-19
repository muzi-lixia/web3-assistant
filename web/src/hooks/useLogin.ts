import { useCallback, useState } from 'react'
import { useConnect, useConnection, useSignMessage, useSwitchChain } from 'wagmi'
import { api, ApiError } from '../lib/api'
import { berachain, hasInjectedWallet } from '../lib/wagmi'
import { useSessionStore } from '../store/session'

export type LoginPhase =
  | 'idle'
  | 'connecting'
  | 'requesting-nonce'
  | 'awaiting-signature'
  | 'verifying'
  | 'success'
  | 'error'

export const PHASE_LABELS: Record<LoginPhase, string> = {
  idle: '连接钱包',
  connecting: '正在连接钱包…',
  'requesting-nonce': '正在获取签名消息…',
  'awaiting-signature': '等待钱包签名…',
  verifying: '正在校验签名…',
  success: '登录成功',
  error: '重试登录',
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  const raw = error as { shortMessage?: string; message?: string; code?: number }
  if (raw?.code === 4001) return '你在钱包中取消了操作。'
  if (raw?.shortMessage) return raw.shortMessage
  if (raw?.message) return raw.message
  return '登录失败，请重试。'
}

export function useLogin() {
  const { address, chainId, isConnected } = useConnection()
  const { connectors, mutateAsync: connectAsync } = useConnect()
  const { mutateAsync: signMessageAsync } = useSignMessage()
  const { mutateAsync: switchChainAsync } = useSwitchChain()
  const signIn = useSessionStore((state) => state.signIn)

  const [phase, setPhase] = useState<LoginPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [nonceNotice, setNonceNotice] = useState<string | null>(null)

  const walletAvailable = hasInjectedWallet()

  const connect = useCallback(async () => {
    setError(null)
    if (!walletAvailable) {
      setPhase('error')
      setError('未检测到浏览器钱包插件。请安装 MetaMask 等 EVM 钱包后刷新页面。')
      return
    }

    const connector = connectors[0]
    if (!connector) {
      setPhase('error')
      setError('没有可用的钱包连接器。')
      return
    }

    try {
      setPhase('connecting')
      await connectAsync({ connector })
      setPhase('idle')
    } catch (caught) {
      setPhase('error')
      setError(describeError(caught))
    }
  }, [connectAsync, connectors, walletAvailable])

  const signInWithWallet = useCallback(async () => {
    if (!address) return
    setError(null)
    setNonceNotice(null)

    try {
      if (chainId !== berachain.id) {
        setPhase('connecting')
        await switchChainAsync({ chainId: berachain.id })
      }

      setPhase('requesting-nonce')
      const nonce = await api.nonce(address)

      setPhase('awaiting-signature')
      let signature: string
      try {
        signature = await signMessageAsync({ message: nonce.message })
      } catch (caught) {
        const code = (caught as { code?: number })?.code
        setPhase('error')
        setError(
          code === 4001
            ? '你拒绝了签名。nonce 未失效，可以直接再次点击签名登录。'
            : describeError(caught),
        )
        setNonceNotice('已下发 nonce 并推送签名请求，等待钱包确认')
        return
      }

      setPhase('verifying')
      const verified = await api.verify(nonce.message, signature)
      signIn(verified)
      setPhase('success')
    } catch (caught) {
      setPhase('error')
      setError(describeError(caught))
      if (caught instanceof ApiError && caught.status === 401) {
        setNonceNotice('nonce 一次性有效，已失效；请重新点击签名登录获取新的 nonce。')
      }
    }
  }, [address, chainId, setPhase, signIn, signMessageAsync, switchChainAsync])

  const reset = useCallback(() => {
    setPhase('idle')
    setError(null)
  }, [])

  return {
    phase,
    error,
    nonceNotice,
    walletAvailable,
    address,
    isConnected,
    connectedChainId: chainId,
    connect,
    signInWithWallet,
    reset,
    busy: phase === 'connecting' || phase === 'requesting-nonce' || phase === 'awaiting-signature' || phase === 'verifying',
  }
}
