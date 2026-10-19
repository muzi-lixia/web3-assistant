/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Reown projectId。缺了钱包弹窗打不开，见 src/lib/wagmi.ts。 */
  readonly VITE_REOWN_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
