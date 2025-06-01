/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly NODE_ENV: "development" | "production" | "test";
  readonly PUBLIC_URL: string;
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_PINATA_JWT: string;
  readonly VITE_WHISK_API_KEY: string;
  readonly VITE_ENVIO_INDEXER_URL: string;
  readonly VITE_PUBLIC_POSTHOG_KEY: string;
  readonly VITE_PUBLIC_POSTHOG_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
