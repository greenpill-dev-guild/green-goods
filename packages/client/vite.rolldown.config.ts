/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenvExpand from "dotenv-expand";
import { resolve } from "path";
import { defineConfig, loadEnv } from "rolldown-vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  dotenvExpand.expand({ parsed: env });

  return {
    plugins: [
      react(),
      tailwindcss(),
      mkcert(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
          globIgnores: ["**/assets/*-{index,vendor,crypto,wallet}*.js"],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit for rolldown builds
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3001,
      host: true,
      proxy: {
        graphql: {
          target: "http://localhost:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/graphql/, ""),
        },
      },
    },
    build: {
      target: "es2020",
      sourcemap: true,
      chunkSizeWarningLimit: 2000, // Higher limit for rolldown
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
