/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_ENVIO_INDEXER_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_OPS_RUNNER_URL?: string;
  readonly VITE_ENABLE_SW_DEV?: string;
  readonly VITE_ENABLE_RPC_BG_SYNC?: string;
  readonly VITE_USE_HASH_ROUTER?: string;
  readonly VITE_PIMLICO_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_QUEUE_DEBUG?: string;
  readonly VITE_MOCK_PWA_INSTALLED?: string;
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_PINATA_GATEWAY_URL?: string;
  readonly VITE_PINATA_API_URL?: string;
  readonly PINATA_JWT?: string;
  readonly PINATA_GATEWAY_URL?: string;
  readonly PINATA_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
