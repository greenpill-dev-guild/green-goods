/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly NODE_ENV: "development" | "production" | "test";
  readonly PUBLIC_URL: string;
  readonly VITE_ALCHEMY_API_KEY: string;
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_PIMLICO_API_KEY: string;
  readonly VITE_PINATA_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
