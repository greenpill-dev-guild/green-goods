/// <reference types="node" />
/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="vite-plugin-svgr/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: "development" | "production" | "test";
    readonly PUBLIC_URL: string;
  }
}
