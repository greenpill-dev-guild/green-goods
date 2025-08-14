/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly NODE_ENV: "development" | "production" | "test";
  readonly PUBLIC_URL: string;
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_PINATA_JWT: string;
  readonly VITE_ENVIO_INDEXER_URL: string;
  readonly VITE_PUBLIC_POSTHOG_KEY: string;
  readonly VITE_PUBLIC_POSTHOG_HOST: string;
  readonly VITE_POSTHOG_DEBUG?: string;
  readonly VITE_ALCHEMY_KEY?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_DESKTOP_DEV?: string;
  readonly VITE_MOCK_PWA_INSTALLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
