/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_INDEXER_URL: string;
  readonly VITE_DEFAULT_CHAIN_ID: string;
  readonly VITE_ENABLE_SW_DEV?: string;
  readonly VITE_MOCK_PWA_INSTALLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}