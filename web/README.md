# Berachain 助手 · 前端

v1 只读查询版的前端实现，对应 `docs/PRD-v1-Berachain-Web3智能助手.md` 与
`Berachain-Web3智能助手-产品原型v1.pdf`。

## 技术栈

| 项 | 选型 |
|---|---|
| 构建 | Vite 8 |
| 框架 | React 19 + TypeScript 7 |
| 组件库 | antd 6（深色主题由 `ConfigProvider` 定制为原型的暖黑 + 金色） |
| 样式 | Tailwind CSS 4（CSS-first `@theme` 定义设计 token） |
| 钱包 | Reown AppKit 1.8 + wagmi 3 + viem 2（WalletConnect 扫码 / 浏览器插件，Berachain Mainnet 80094） |
| 数据 | TanStack Query 5（服务端状态）+ Zustand 5（登录态、对话列表） |

## 本地运行

```bash
cd web
cp .env.example .env  # 填 VITE_REOWN_PROJECT_ID（https://cloud.reown.com 免费创建）
npm install
npm run dev          # http://localhost:5173
```

`VITE_REOWN_PROJECT_ID` 是钱包弹窗（AppKit / WalletConnect）的必需项，缺失时页面会直接报错，
不会静默退化成只能用浏览器插件。

开发服务器把 `/api` 代理到 `http://127.0.0.1:8000`（见 `vite.config.ts`），
后端未启动时登录页仍可打开，接口请求会失败并给出提示。

生产构建：

```bash
npm run build        # 产物在 dist/
```

部署到与后端不同域时，构建前设置 `VITE_API_BASE`（例如 `https://api.example.com`），
并同步后端 CORS 白名单。

## 目录

```
src/
├── pages/            LoginPage（钱包签名登录）、WorkspacePage（对话主工作台）
├── components/
│   ├── TopBar / Composer / ChatThread / AssistantMessage / TokenScopeDrawer
│   └── cards/        Panel（卡片骨架 + 溯源条）、AssetCard、StakingCard、TxCard
├── hooks/            useLogin、useChat（SSE 消费）、useSessionCountdown
├── lib/              api（REST）、sse（POST 流式解析）、wagmi、format
├── store/            session（JWT、地址、到期时间，持久化到 localStorage）
├── fixtures/         交易记录示例数据
└── theme.ts          antd 主题 token
```

## 对接的接口

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/v1/auth/nonce` | 取 nonce 与待签名消息 |
| POST | `/api/v1/auth/verify` | 提交签名，换取 JWT |
| GET | `/api/v1/auth/me` | 刷新页面后校验本地令牌 |
| GET / PUT | `/api/v1/tokens` | 读取 / 保存 token 范围 |
| POST | `/api/v1/chat` | 对话，返回 `text/event-stream` |

`/chat` 的事件序列：`context`（新建或回显 `conversation_id`）→ `intent` →
`answer`（文本）→ `data`（卡片 payload）→ `provenance`（溯源）→ `done`；失败时为 `error`。
请求体带上一轮的 `conversation_id` 时服务端沿用同一段对话上下文（用于「那质押呢」这类追问），
不带则由服务端新建。因为 EventSource 不支持 POST，`lib/sse.ts` 用 `fetch` +
`ReadableStream` 按空行手工切帧。

## 与后端现状的三处落差（前端已按「不可得」呈现，未编造）

1. **交易记录（FR-04）后端尚无接口**：`TxCard` 用 `src/fixtures/transactions.ts`
   的示例数据，卡片上标注「示例数据」。开发模式下左下角有「示例：交易记录卡」按钮
   可直接预览；接口就绪后替换数据源即可。
2. **质押只返回一部分**：`staking_position` 只给出 sWBERA 持仓与折算值，
   Vault 在押份额、解锁排队、可领取均标记为「暂不可得」并显示服务端给出的原因。
   卡片没有编造解锁进度或预计可领取时间。
3. **登出尚未接入服务端**：后端已提供 `POST /api/v1/auth/logout`（吊销 jti），
   前端顶栏「退出」目前只清理本地会话，尚未调用该接口。

## 交互约定

- Enter 发送、Shift+Enter 换行，中文输入法合成期间不触发发送。
- 会话剩余时间每秒刷新，归零或任一接口返回 401 时清会话并回到登录页。
- 对话区只在用户位于底部附近时自动跟随滚动，不打断向上翻看。
- token 范围为空时禁止保存，不回退为全量扫描（PRD FR-02.6）。
