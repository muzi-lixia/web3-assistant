import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Drawer, Grid, Input, message } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/cn'
import { shortAddress } from '../lib/format'
import type { TokenItem } from '../types/api'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const MAX_TOKENS = 100
const EMPTY_TOKENS: TokenItem[] = []

type PresetKey = 'default' | 'staking' | 'clear'

export function TokenScopeDrawer({
  open,
  onClose,
  onCountChange,
}: {
  open: boolean
  onClose: () => void
  onCountChange?: (count: number) => void
}) {
  const screens = Grid.useBreakpoint()
  const queryClient = useQueryClient()
  const [messageApi, holder] = message.useMessage()

  const scopeQuery = useQuery({
    queryKey: ['token-scope'],
    queryFn: api.readScope,
    enabled: open,
    staleTime: 30_000,
  })

  const tokens = scopeQuery.data?.tokens ?? EMPTY_TOKENS
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [addressInput, setAddressInput] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const serverSelected = useMemo(
    () => new Set(tokens.filter((token) => token.selected).map((token) => token.address.toLowerCase())),
    [tokens],
  )

  useEffect(() => {
    if (!open || !scopeQuery.data) return
    const selected = scopeQuery.data.tokens
      .filter((token) => token.selected)
      .map((token) => token.address.toLowerCase())
    setDraft(new Set(selected))
    onCountChange?.(selected.length)
  }, [onCountChange, open, scopeQuery.data])

  const dirty = useMemo(() => {
    if (draft.size !== serverSelected.size) return true
    for (const address of draft) {
      if (!serverSelected.has(address)) return true
    }
    return false
  }, [draft, serverSelected])

  const saveMutation = useMutation({
    mutationFn: (addresses: string[]) => api.saveScope(addresses),
    onSuccess: (data) => {
      queryClient.setQueryData(['token-scope'], data)
      onCountChange?.(data.tokens.filter((token) => token.selected).length)
    },
  })

  const toggle = useCallback((address: string) => {
    const key = address.toLowerCase()
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const applyPreset = (preset: PresetKey) => {
    if (preset === 'clear') {
      setDraft(new Set())
      return
    }
    if (preset === 'default') {
      setDraft(new Set(tokens.map((token) => token.address.toLowerCase())))
      return
    }
    setDraft(
      new Set(
        tokens
          .filter((token) => /WBERA/i.test(token.symbol))
          .map((token) => token.address.toLowerCase()),
      ),
    )
  }

  const handleSave = async () => {
    if (draft.size === 0) return
    try {
      await saveMutation.mutateAsync(Array.from(draft))
      messageApi.success('Token 范围已保存')
      onClose()
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const handleAdd = async () => {
    setAddError(null)
    const candidate = addressInput.trim()

    if (!ADDRESS_PATTERN.test(candidate)) {
      setAddError('地址格式不正确：需要 0x 开头的 40 位十六进制地址。')
      return
    }
    if (draft.has(candidate.toLowerCase())) {
      setAddError('该地址已在当前范围内，不产生重复项。')
      return
    }
    if (draft.size + 1 > MAX_TOKENS) {
      setAddError(`超过 ${MAX_TOKENS} 项上限，请先移除部分 token。`)
      return
    }

    try {
      await saveMutation.mutateAsync([...Array.from(draft), candidate])
      setAddressInput('')
      messageApi.success('已加入范围')
    } catch (error) {
      const detail = error instanceof ApiError ? error.message : ''
      setAddError(
        `服务端拒绝加入该地址：${
          detail.includes('不在支持范围内') ? '尚未核验该合约（当前仅支持已核验 token）' : detail || '校验未通过'
        }`,
      )
    }
  }

  return (
    <>
      {holder}
      <Drawer
        open={open}
        onClose={onClose}
        placement="right"
        size={screens.md ? 400 : '100%'}
        closable={false}
        title={
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-ink">Token 范围</div>
            <p className="mt-1 text-[11.5px] font-normal text-ink-4">
              范围按会话地址隔离，不同地址之间互不相通，也不会串用。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭 Token 范围面板"
            className="-mr-1 cursor-pointer rounded-[6px] p-1.5 text-ink-3 transition-colors hover:bg-panel-raised hover:text-ink"
          >
            <CloseOutlined />
          </button>
        </div>
      }
      styles={{ body: { padding: '16px 20px 20px' }, footer: { padding: '12px 20px' } }}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-4">
            {dirty ? '有未保存的改动' : '与已保存范围一致'}
          </span>
          <span className="flex gap-2">
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              disabled={!dirty || draft.size === 0}
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              保存范围
            </Button>
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-ink-4">预设</span>
        <Button size="small" onClick={() => applyPreset('default')} disabled={tokens.length === 0}>
          默认集合
        </Button>
        <Button size="small" onClick={() => applyPreset('staking')} disabled={tokens.length === 0}>
          仅质押相关
        </Button>
        <Button size="small" onClick={() => applyPreset('clear')} disabled={tokens.length === 0}>
          清空
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11.5px] text-ink-4">
        <span>
          已加入 <span className="num text-ink-2">{draft.size}</span> 项 · 资产聚合的 token 集合
        </span>
        <span>上限 {MAX_TOKENS} 项</span>
      </div>

      <div className="mt-2 overflow-hidden rounded-[10px] border border-line">
        {scopeQuery.isLoading ? (
          <div className="px-3 py-6 text-center text-[12px] text-ink-4">正在读取当前范围…</div>
        ) : null}

        {scopeQuery.error ? (
          <div className="px-3 py-6 text-center text-[12px] text-danger">
            {(scopeQuery.error as Error).message}
          </div>
        ) : null}

        {!scopeQuery.isLoading && !scopeQuery.error && tokens.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-ink-4">服务端未返回任何可核验 token</div>
        ) : null}

        {tokens.map((token) => {
          const key = token.address.toLowerCase()
          const checked = draft.has(key)
          return (
            <label
              key={token.address}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 border-b border-line-soft px-3 py-2.5 last:border-b-0 transition-colors',
                checked ? 'bg-white/[0.02]' : 'hover:bg-white/[0.015]',
              )}
            >
              <Checkbox checked={checked} onChange={() => toggle(token.address)} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-ink">{token.symbol}</span>
                <span className="num block text-[10.5px] text-ink-4">{shortAddress(token.address, 8, 4)}</span>
              </span>
            </label>
          )
        })}
      </div>

      <div className="mt-6">
        <p className="text-[11.5px] text-ink-3">添加 token（ERC-20 合约地址）</p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={addressInput}
            placeholder="0x… 粘贴合约地址"
            onChange={(event) => {
              setAddressInput(event.target.value)
              setAddError(null)
            }}
            onPressEnter={handleAdd}
            className="num !text-[12px]"
            aria-invalid={Boolean(addError)}
          />
          <Button onClick={handleAdd} loading={saveMutation.isPending}>
            校验并添加
          </Button>
        </div>
        {addError ? (
          <p className="mt-2 text-[11.5px] leading-relaxed text-danger" role="alert">
            {addError}
          </p>
        ) : (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-4">
            仅接受服务端已核验的 ERC-20：未核验地址会被拒绝并说明原因。
          </p>
        )}
      </div>

      {draft.size === 0 ? (
        <p className="mt-6 rounded-[8px] border border-warn/30 bg-warn/[0.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-warn">
          范围内无 token 时资产查询无法执行；系统不会自动回退为全量扫描，请至少保留一个。
        </p>
      ) : null}
      </Drawer>
    </>
  )
}
