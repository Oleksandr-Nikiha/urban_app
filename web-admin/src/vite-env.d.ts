/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Підписаний initData для розробки у браузері — див. src/telegram/env.ts */
  readonly VITE_DEV_INIT_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
