/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly NODE_ENV: "development" | "production" | "test";
  readonly PUBLIC_URL: string;
  readonly VITE_STORACHA_KEY?: string;
  readonly VITE_STORACHA_PROOF?: string;
  readonly VITE_STORACHA_GATEWAY?: string;
  readonly VITE_ENVIO_INDEXER_URL: string;
  readonly VITE_PUBLIC_POSTHOG_KEY: string;
  readonly VITE_PUBLIC_POSTHOG_HOST: string;
  readonly VITE_POSTHOG_DEBUG?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_DESKTOP_DEV?: string;
  readonly VITE_MOCK_PWA_INSTALLED?: string;
  readonly VITE_DEBUG_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
