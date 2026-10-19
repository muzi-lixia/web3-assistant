const SOURCE_LABELS: Record<string, string> = {
  'berachain-rpc': '链上 RPC',
  defillama: 'DeFiLlama',
  'browser-api': 'Browser API',
  coingecko: 'CoinGecko',
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!address) return ''
  if (address.length <= head + tail + 2) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

function groupInteger(value: string): string {
  const [int, frac] = value.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac === undefined ? grouped : `${grouped}.${frac}`
}

/** 数量：保留后端给出的精度，仅补千分位 */
export function formatAmount(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  return groupInteger(value)
}

export function formatUsd(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return `$${numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function isZeroAmount(value: string): boolean {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric === 0
}

export function formatBlock(height: number): string {
  return `#${height.toLocaleString('en-US')}`
}

export function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function maskSignature(signature: string): string {
  return shortAddress(signature, 10, 8)
}
