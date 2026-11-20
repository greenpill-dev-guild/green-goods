/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string;
  readonly VITE_DEV_CHAIN_MODE?: string;
  readonly VITE_LOCAL_FORK_RPC_URL?: string;
  readonly VITE_ENABLE_ANVIL_WALLETS?: string;
  readonly VITE_PIMLICO_API_KEY: string;
  readonly VITE_PASSKEY_RP_ID?: string;
  readonly VITE_PASSKEY_SERVER_ENABLED?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_ENVIO_INDEXER_URL?: string;
  readonly VITE_GARDENS_SUBGRAPH_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PINATA_GATEWAY_URL?: string;
  readonly VITE_ENABLE_SW_DEV?: string;
  readonly VITE_APP_VERSION?: string;
  // Telemetry segmentation, defined by the App and Hub builds (PRD-1560).
  readonly VITE_APP_SURFACE?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_TELEMETRY_RELEASE?: string;
  readonly VITE_TELEMETRY_TEST_GARDENS?: string;
  readonly VITE_TELEMETRY_TEST_ACCOUNT_DIGESTS?: string;
  readonly VITE_PIMLICO_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_USE_HASH_ROUTER?: string;
  readonly VITE_ERC7677_PROXY_URL?: string;
  readonly NODE_ENV?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
