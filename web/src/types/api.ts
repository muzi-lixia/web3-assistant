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

export interface Unavailable {
  available: false
  reason: string
}

export interface StakingPayload {
  block_height: number
  in_position: {
    symbol: string
    shares: string
    equivalent_wbera: string
  }
  unlocking: { available: boolean; reason?: string }
  claimable: { available: boolean; reason?: string }
}

export type CapabilityName = 'asset_balance' | 'staking_position'

export type TxKind = '普通' | '内部' | 'ERC-20'
export type TxStatus = 'success' | 'pending' | 'failed'

export interface TxRecordDto {
  id: string
  hoursAgo: number
  kind: TxKind
  summary: string
  status: TxStatus
  reason?: string
  block: number | null
}

export interface TxPayload {
  rangeDays: number
  depthDays: number
  records: TxRecordDto[]
}

export type CapabilityPayload =
  | { capability: 'asset_balance'; answer: AssetPayload }
  | { capability: 'staking_position'; answer: StakingPayload }
  | { capability: 'transaction_records'; answer: TxPayload }

export interface ChatErrorPayload {
  code: string
  message: string
  retryable: boolean
}

export function isAssetPayload(payload: unknown): payload is AssetPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as AssetPayload).items) &&
    typeof (payload as AssetPayload).total_value_usd === 'string'
  )
}

export function isStakingPayload(payload: unknown): payload is StakingPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as StakingPayload).in_position === 'object' &&
    (payload as StakingPayload).in_position !== null
  )
}
