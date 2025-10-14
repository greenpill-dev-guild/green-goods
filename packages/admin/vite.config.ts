/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenvExpand from "dotenv-expand";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig(({ mode }) => {
  const rootDir = resolve(__dirname, "../../");

  const rootEnv = loadEnv(mode, rootDir, "");
  dotenvExpand.expand({ parsed: rootEnv });

  const localEnv = loadEnv(mode, __dirname, "");
  dotenvExpand.expand({ parsed: localEnv });

  const plugins = [
    mkcert(),
    tailwindcss(),
    react(),
  ];

  return {
    envDir: rootDir,
    envPrefix: ["VITE_", "PRIVY_", "SKIP_"],
    build: { target: "es2020", sourcemap: true, chunkSizeWarningLimit: 2000 },
    plugins,
    resolve: { alias: { "@": resolve(__dirname, "./src") } },
    server: {
      port: 3002,
      strictPort: true,
      host: true,
      hmr: { overlay: true },
      watch: { usePolling: true, interval: 100 },
      proxy: {
        // Proxy indexer requests to avoid CORS issues in development
        '/api/graphql': {
          target: localEnv.VITE_ENVIO_INDEXER_URL || '',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/graphql/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('🔥 Indexer proxy error:', err);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log('📡 Proxying request to indexer:', req.url);
            });
          }
        }
      }
    },
  };
});