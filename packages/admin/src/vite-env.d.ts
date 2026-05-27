/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_ENVIO_INDEXER_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_DEV_CHAIN_MODE?: string;
  readonly VITE_LOCAL_FORK_RPC_URL?: string;
  readonly VITE_ENABLE_ANVIL_WALLETS?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_ENABLE_SW_DEV?: string;
  readonly VITE_ENABLE_RPC_BG_SYNC?: string;
  readonly VITE_USE_HASH_ROUTER?: string;
  readonly VITE_CLIENT_APP_URL?: string;
  readonly VITE_PIMLICO_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_QUEUE_DEBUG?: string;
  readonly VITE_MOCK_PWA_INSTALLED?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PINATA_GATEWAY_URL?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_SENTRY_ADMIN_DSN?: string;
  readonly VITE_SENTRY_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
