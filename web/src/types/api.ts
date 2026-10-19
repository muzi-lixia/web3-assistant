export interface NonceResponse {
  nonce: string
  message: string
  expires_in: number
}

export interface VerifyResponse {
  address: string
  display_address: string
  token: string
  expires_in: number
}

export interface MeResponse {
  address: string
  display_address: string
}

export interface TokenItem {
  symbol: string
  address: string
  selected: boolean
}

export interface ScopeResponse {
  tokens: TokenItem[]
}

export interface ProvenanceItem {
  field: string
  source: string
  at: string
}

/** asset_balance */
export interface AssetItem {
  symbol: string
  amount: string
  native: boolean
  address: string | null
  price_usd: string | null
  value_usd: string | null
}

export interface AssetPayload {
  address: string
  block_height: number
  items: AssetItem[]
  total_value_usd: string
  valuation_note: string | null
}

/** staking_position */
export interface StakingPosition {
  symbol: string
  shares: string
  equivalent_wbera: string
}

/** 一笔解锁请求：ready_at = 请求时间 + 解锁期，是否到期以链上区块时间为准 */
export interface UnlockItem {
  request_id: number
  assets: string
  request_time: number
  ready_at: number
  ready: boolean
  remaining_seconds: number
}

export interface UnlockBucket {
  available: boolean
  reason?: string
  items: UnlockItem[]
  total_assets: string
}

export interface StakingPayload {
  block_height: number
  block_time: number
  in_position: StakingPosition
  unlocking: UnlockBucket
  claimable: UnlockBucket
}

/** transaction_history */
export type TxDirection = 'in' | 'out'
export type TxStatus = 'ok' | 'failed'

export interface TransactionItem {
  hash: string
  timestamp: number
  from: string
  to: string
  direction: TxDirection
  value: string
  block: number
  status: TxStatus
}

export interface TransactionPayload {
  address: string
  items: TransactionItem[]
  count: number
  limit: number
}

export type CapabilityName = 'asset_balance' | 'staking_position' | 'transaction_history'

export type CapabilityPayload =
  | { capability: 'asset_balance'; data: AssetPayload }
  | { capability: 'staking_position'; data: StakingPayload }
  | { capability: 'transaction_history'; data: TransactionPayload }

/** data 事件里的一次工具调用：参数、结果、溯源都在同一条记录里 */
export interface CapabilityCall {
  name: string
  arguments: Record<string, unknown>
  data: unknown
  provenance: ProvenanceItem[]
}

export interface ChatErrorPayload {
  code: string
  message: string
  retryable: boolean
}

export function isAssetPayload(data: unknown): data is AssetPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as AssetPayload).items) &&
    typeof (data as AssetPayload).total_value_usd === 'string'
  )
}

export function isStakingPayload(data: unknown): data is StakingPayload {
  if (typeof data !== 'object' || data === null) return false
  const value = data as StakingPayload
  return (
    typeof value.in_position === 'object' &&
    value.in_position !== null &&
    typeof value.unlocking === 'object' &&
    value.unlocking !== null &&
    typeof value.claimable === 'object' &&
    value.claimable !== null
  )
}

export function isTransactionPayload(data: unknown): data is TransactionPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as TransactionPayload).items) &&
    typeof (data as TransactionPayload).limit === 'number'
  )
}

/** 后端先下发意图，再下发数据；按意图收窄 payload，不靠猜结构 */
export function toCapabilityPayload(
  capability: string,
  data: unknown,
): CapabilityPayload | undefined {
  switch (capability) {
    case 'asset_balance':
      return isAssetPayload(data) ? { capability, data } : undefined
    case 'staking_position':
      return isStakingPayload(data) ? { capability, data } : undefined
    case 'transaction_history':
      return isTransactionPayload(data) ? { capability, data } : undefined
    default:
      return undefined
  }
}
