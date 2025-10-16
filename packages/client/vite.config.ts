/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenvExpand from "dotenv-expand";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const rootDir = resolve(__dirname, "../../");

  const rootEnv = loadEnv(mode, rootDir, "");
  dotenvExpand.expand({ parsed: rootEnv });

  const localEnv = loadEnv(mode, __dirname, "");
  dotenvExpand.expand({ parsed: localEnv });

  const enableRpcBgSync =
    rootEnv.VITE_ENABLE_RPC_BG_SYNC === "true" || localEnv.VITE_ENABLE_RPC_BG_SYNC === "true";

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

  const plugins = [
    mkcert(),
    tailwindcss(),
    react(),
    VitePWA({
      includeAssets: [
        "favicon.ico",
        "icon.png",
        "apple-icon.png",
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
        "images/ms-icon-310.png",
        "images/home.png",
        "images/work.png",
        "images/profile.png",
      ],
      injectRegister: "auto",
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ["**/*.{html,ico,png,svg}", "**/assets/*.css"],
        runtimeCaching: [
          {
            urlPattern: /.*\.js$/,
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
            urlPattern: /^https:\/\/api\.pinata\.cloud/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /graphql/,
            handler: "NetworkFirst",
            options: {
              cacheName: "graphql-cache",
              networkTimeoutSeconds: 5,
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
        name: "Green Goods",
        short_name: "Green Goods",
        icons: [
          { src: "/images/android-icon-36x36.png", sizes: "36x36", type: "image/png" },
          { src: "/images/android-icon-48x48.png", sizes: "48x48", type: "image/png" },
          { src: "/images/android-icon-72x72.png", sizes: "72x72", type: "image/png" },
          { src: "/images/android-icon-144x144.png", sizes: "144x144", type: "image/png" },
          { src: "/apple-icon.png", sizes: "192x192", type: "image/png" },
        ],
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#fff",
        background_color: "#fff",
        shortcuts: [
          {
            name: "Home",
            description: "View Gardens",
            url: "/home",
            icons: [{ src: "images/home.png", sizes: "64x64", type: "image/png" }],
          },
          {
            name: "Garden",
            description: "Upload your work",
            url: "/garden",
            icons: [{ src: "images/work.png", sizes: "64x64", type: "image/png" }],
          },
          {
            name: "Profile",
            description: "View your profile",
            url: "/profile",
            icons: [{ src: "images/profile.png", sizes: "64x64", type: "image/png" }],
          },
        ],
        related_applications: [
          { platform: "webapp", url: "https://localhost:3001/manifest.webmanifest" },
        ],
        categories: [],
      },
      devOptions: { enabled: process.env.VITE_ENABLE_SW_DEV === "true" },
    }),
  ];

  return {
    envDir: rootDir,
    envPrefix: ["VITE_", "PRIVY_", "SKIP_"],
    build: { target: "es2020", sourcemap: true, chunkSizeWarningLimit: 2000 },
    plugins,
    resolve: { alias: { "@": resolve(__dirname, "./src") } },
    server: {
      port: 3001,
      strictPort: true,
      host: true,
      hmr: { overlay: true },
      watch: { usePolling: true, interval: 100 },
      proxy: {
        "/pinata/uploads": {
          target: "https://uploads.pinata.cloud",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/pinata\/uploads/, ""),
        },
        "/pinata/api": {
          target: "https://api.pinata.cloud",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/pinata\/api/, ""),
        },
        "/pinata/gateway": {
          target: "https://greengoods.mypinata.cloud",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/pinata\/gateway/, ""),
        },
        "/indexer": {
          target: "https://indexer.hyperindex.xyz/0bf0e0f/v1",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/indexer/, ""),
        },
      },
    },
  };
});
