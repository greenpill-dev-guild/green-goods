/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

export default defineConfig(async () => {
  const rootDir = resolve(__dirname, "../../");
  // Resolve env schema from monorepo root even when this package script runs with a package cwd.
  process.chdir(rootDir);
  const [{ varlockVitePlugin }, { ENV }] = await Promise.all([
    import("@varlock/vite-integration"),
    import("varlock/env"),
  ]);
  const enableRpcBgSync = String(ENV.VITE_ENABLE_RPC_BG_SYNC) === "true";

  const rpcBgSyncCaching: NonNullable<NonNullable<VitePWAOptions["workbox"]>["runtimeCaching"]> =
    enableRpcBgSync
      ? ([
          {
            urlPattern: /https:\/\/api\.pimlico\.xyz\/.*\/rpc$/,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "rpc-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            urlPattern: /https:\/\/(\w+\.)?alchemyapi\.io\/v2\/.*/,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "rpc-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
        ] as NonNullable<NonNullable<VitePWAOptions["workbox"]>["runtimeCaching"]>)
      : ([] as NonNullable<NonNullable<VitePWAOptions["workbox"]>["runtimeCaching"]>);

  // Use relative paths for IPFS builds
  const isIPFSBuild = String(ENV.VITE_USE_HASH_ROUTER) === "true";
  const appBasePath = isIPFSBuild ? "./" : "/";
  const shortcutUrl = (path: string) => (isIPFSBuild ? `./#${path}` : path);

  // Skip mkcert in devcontainer, CI, or when SKIP_MKCERT is set
  // SKIP_MKCERT is useful when sudo is broken (e.g., "you do not exist in passwd database")
  const isDevContainer = process.env.DEVCONTAINER === "true";
  const isCI = process.env.CI === "true";
  const skipMkcert = process.env.SKIP_MKCERT === "true";

  const plugins = [
    varlockVitePlugin(),
    // Only use mkcert for HTTPS when not in devcontainer, CI, or explicitly skipped
    ...(isDevContainer || isCI || skipMkcert ? [] : [mkcert()]),
    tailwindcss(),
    // React Compiler: Automatically optimizes components with memoization
    // Eliminates need for manual useMemo/useCallback in most cases
    // @see https://react.dev/learn/react-compiler
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
    VitePWA({
      includeAssets: [
        "favicon.ico",
        "apple-icon.png",
        "icon-192.png",
        "icon.png",
        "icon-512.png",
        "maskable-icon-512.png",
        "images/android-icon-36x36.png",
        "images/android-icon-48x48.png",
        "images/android-icon-72x72.png",
        "images/android-icon-144x144.png",
        "images/apple-icon-57x57.png",
        "images/apple-icon-60x60.png",
        "images/apple-icon-72x72.png",
        "images/apple-icon-120x120.png",
        "images/apple-icon-144x144.png",
        "images/ms-icon-70x70.png",
        "images/ms-icon-144x144.png",
        "images/ms-icon-310x310.png",
      ],
      injectRegister: "auto",
      registerType: "prompt",
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ["**/*.{html,js,css,ico,png,svg}"],
        cleanupOutdatedCaches: true,
        importScripts: ["sw-custom.js"],
        runtimeCaching: [
          {
            // Only cache JS files from the same origin (avoids caching external analytics/ads)
            // Note: 'self' refers to the ServiceWorkerGlobalScope when running, but here we construct the config.
            // We use a regex that matches relative paths (same origin) ending in .js
            urlPattern: /^\/.*\.js$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "js-cache",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /.*\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // IPFS content is immutable (same CID = same bytes forever), so cache aggressively.
            // Matches dedicated Pinata gateway + public IPFS gateways.
            urlPattern:
              /https:\/\/(greengoods\.mypinata\.cloud|gateway\.pinata\.cloud|storacha\.link|w3s\.link|ipfs\.io)\/ipfs\/.+/,
            handler: "CacheFirst",
            options: {
              cacheName: "ipfs-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year — CIDs are immutable
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Indexer API - show cached immediately, revalidate in background
            urlPattern: /indexer\.hyperindex\.xyz|localhost:8080/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "indexer-cache",
              expiration: {
                maxAgeSeconds: 24 * 60 * 60, // 24 hours for offline
                maxEntries: 100,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // GraphQL fallback (EAS, etc.) - show cached immediately, revalidate in background
            urlPattern: /graphql/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "graphql-cache",
              expiration: {
                maxAgeSeconds: 24 * 60 * 60, // 24 hours for offline
                maxEntries: 100,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Background sync for critical POSTs (users/me updates as example)
          {
            urlPattern: /\/users\/me$/,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "gg-api-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          ...rpcBgSyncCaching,
        ],
      },
      manifest: {
        id: appBasePath,
        name: "Green Goods",
        short_name: "Green Goods",
        // Window Controls Overlay: Native desktop app feel (removes browser titlebar)
        // Falls back to standalone on mobile or unsupported browsers
        display_override: ["window-controls-overlay", "standalone"],
        icons: [
          { src: "images/android-icon-72x72.png", sizes: "72x72", type: "image/png" },
          { src: "images/android-icon-144x144.png", sizes: "144x144", type: "image/png" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "maskable-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        start_url: appBasePath,
        scope: appBasePath,
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#fff",
        background_color: "#fff",
        shortcuts: [
          {
            name: "Home",
            description: "View Gardens",
            url: shortcutUrl("/home"),
            icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Garden",
            description: "Upload your work",
            url: shortcutUrl("/garden"),
            icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Profile",
            description: "View your profile",
            url: shortcutUrl("/profile"),
            icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        categories: [],
      },
      devOptions: { enabled: String(ENV.VITE_ENABLE_SW_DEV) === "true" },
    }),
  ];

  return {
    base: appBasePath,
    envDir: rootDir,
    envPrefix: ["VITE_", "PINATA_", "SKIP_"],
    build: { sourcemap: true, chunkSizeWarningLimit: 2000 },
    plugins,
    // Deduplicate React and PostHog to prevent multiple instances
    resolve: {
      dedupe: ["react", "react-dom", "posthog-js"],
      alias: {
        "@": resolve(__dirname, "./src"),
        "@green-goods/shared": resolve(__dirname, "../shared/src"),
        "@green-goods/shared/components": resolve(__dirname, "../shared/src/components"),
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
        "@green-goods/contracts/deployments": resolve(__dirname, "../contracts/deployments"),
        "@green-goods/contracts/abis": resolve(__dirname, "../contracts/abis"),
      },
      // Add conditions for proper module resolution on Vercel
      conditions: ["import", "module", "browser", "default"],
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
      // Include CJS packages that need named exports extracted
      include: [
        "react",
        "react-dom",
        "posthog-js",
        "@ethereum-attestation-service/eas-sdk",
        "multiformats",
      ],
      // Exclude local packages and ESM-only packages
      exclude: ["@green-goods/shared"],
    },
    server: {
      port: 3001,
      strictPort: true,
      host: true,
      open: true,
      hmr: { overlay: true },
      watch: { usePolling: true, interval: 100 },
      proxy: {
        "/indexer": {
          target:
            process.env.NODE_ENV === "development"
              ? "http://localhost:8080/v1/graphql"
              : (ENV.VITE_ENVIO_INDEXER_URL ?? "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql"),
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/indexer/, ""),
        },
      },
    },
  };
});
