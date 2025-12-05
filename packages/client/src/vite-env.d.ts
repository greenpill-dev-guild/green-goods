/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string;
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
  readonly VITE_ALCHEMY_API_KEY: string;
  readonly VITE_ENVIO_INDEXER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
