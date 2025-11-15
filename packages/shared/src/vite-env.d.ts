/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string;
  readonly VITE_DEFAULT_CHAIN_ID: string;
  readonly VITE_PIMLICO_API_KEY: string;
  readonly VITE_ENABLE_SW_DEV: string;
  readonly VITE_ENABLE_RPC_BG_SYNC: string;
  readonly NODE_ENV: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
