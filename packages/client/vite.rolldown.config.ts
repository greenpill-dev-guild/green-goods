/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenvExpand from "dotenv-expand";
import { resolve } from "path";
import { defineConfig, loadEnv } from "rolldown-vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  // Load environment variables from monorepo root first, then local overrides
  const rootDir = resolve(__dirname, "../../");

  // 1) Load from monorepo root .env files (foundation)
  const rootEnv = loadEnv(mode, rootDir, "");
  dotenvExpand.expand({ parsed: rootEnv });

  // 2) Load from package-specific .env files (overrides)
  const localEnv = loadEnv(mode, __dirname, "");
  dotenvExpand.expand({ parsed: localEnv });

  return {
    // Environment configuration
    envDir: rootDir,
    envPrefix: ["VITE_", "PRIVY_", "SKIP_"],
    plugins: [
      react({}),
      tailwindcss(),
      mkcert(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
          globIgnores: ["**/assets/*-{index,vendor,crypto,wallet}*.js"],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit for rolldown builds
        },
        // Keep the service worker disabled in dev unless explicitly enabled via env
        devOptions: {
          enabled: process.env.VITE_ENABLE_SW_DEV === "true",
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
      hmr: {
        overlay: true,
      },
      watch: {
        usePolling: true,
        interval: 100,
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
