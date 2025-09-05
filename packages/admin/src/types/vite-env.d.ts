/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_ENVIO_INDEXER_URL: string;
  readonly VITE_DEFAULT_CHAIN_ID: string;
  readonly VITE_ALCHEMY_KEY: string;
  readonly VITE_ENABLE_SW_DEV?: string;
  readonly VITE_MOCK_PWA_INSTALLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}