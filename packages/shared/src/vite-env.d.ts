/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string;
  readonly VITE_PIMLICO_API_KEY: string;
  readonly VITE_PASSKEY_RP_ID?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_ENVIO_INDEXER_URL?: string;
  readonly VITE_GARDENS_SUBGRAPH_KEY?: string;
  readonly VITE_ENABLE_SW_DEV?: string;
  readonly VITE_ENABLE_RPC_BG_SYNC?: string;
  readonly VITE_PIMLICO_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_USE_HASH_ROUTER?: string;
  readonly VITE_OPS_RUNNER_URL?: string;
  readonly VITE_ERC7677_PROXY_URL?: string;
  readonly NODE_ENV?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
