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

  // Use relative paths for IPFS builds
  const isIPFSBuild =
    rootEnv.VITE_USE_HASH_ROUTER === "true" || localEnv.VITE_USE_HASH_ROUTER === "true";

  const plugins = [
    mkcert(),
    tailwindcss(),
    react(),
  ];

  return {
    base: isIPFSBuild ? "./" : "/",
    envDir: rootDir,
    envPrefix: ["VITE_", "PRIVY_", "SKIP_"],
    build: { target: "es2020", sourcemap: true, chunkSizeWarningLimit: 2000 },
    plugins,
    // Deduplicate React and PostHog to prevent multiple instances
    resolve: {
      dedupe: ['react', 'react-dom', 'posthog-js'],
      alias: {
        "@": resolve(__dirname, "./src"),
        "@green-goods/shared": resolve(__dirname, "../shared/src"),
        "@green-goods/shared/hooks": resolve(__dirname, "../shared/src/hooks"),
        "@green-goods/shared/providers": resolve(__dirname, "../shared/src/providers"),
        "@green-goods/shared/modules": resolve(__dirname, "../shared/src/modules"),
        "@green-goods/shared/utils": resolve(__dirname, "../shared/src/utils"),
        "@green-goods/shared/config": resolve(__dirname, "../shared/src/config"),
        "@green-goods/shared/types": resolve(__dirname, "../shared/src/types"),
        "@green-goods/shared/stores": resolve(__dirname, "../shared/src/stores"),
        "@green-goods/shared/mocks": resolve(__dirname, "../shared/src/mocks"),
        "@green-goods/shared/i18n": resolve(__dirname, "../shared/src/i18n"),
        "@green-goods/shared/workflows": resolve(__dirname, "../shared/src/workflows"),
        "@green-goods/shared/constants": resolve(__dirname, "../shared/src/constants"),
      }
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'posthog-js',
      ],
      exclude: ['@green-goods/shared'],
    },
    server: {
      port: 3002,
      strictPort: true,
      host: true,
      hmr: { overlay: true },
      watch: { usePolling: true, interval: 100 },
      proxy: {
        // Proxy indexer requests to avoid CORS issues in development
        '/api/graphql': {
          target: process.env.NODE_ENV === "development" ? "http://localhost:8080/v1/graphql" : localEnv.VITE_ENVIO_INDEXER_URL || '',
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