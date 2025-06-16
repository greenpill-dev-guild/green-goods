/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenvExpand from "dotenv-expand";
import { defineConfig, loadEnv } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // This check is important!
  if (mode === "development") {
    const env = loadEnv(mode, process.cwd(), "");
    dotenvExpand.expand({ parsed: env });
  }

  return {
    test: {
      env: loadEnv(mode, process.cwd(), ""),
      environment: "jsdom",
      setupFiles: "./src/__tests__/setupTests.ts", // Optional: setup file
    },
    build: {
      target: 'es2020',
      sourcemap: true,
      chunkSizeWarningLimit: 2000,
    },
    plugins: [
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
        devOptions: {
          enabled: true,
        },
        workbox: {
          // Increase the limit to handle larger bundles (10 MB)
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          // Only cache smaller, essential files in the service worker
          globPatterns: [
            "**/*.{html,ico,png,svg}",
            "**/assets/*.css",
            // Exclude the largest JS bundles from SW precaching
            "!**/assets/*-{index,vendor,crypto,wallet}*.js"
          ],
          // Use runtime caching for large JS files
          runtimeCaching: [
            {
              urlPattern: /.*\.js$/,
              handler: "CacheFirst",
              options: {
                cacheName: "js-cache",
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        manifest: {
          name: "Green Goods",
          short_name: "Green Goods",
          icons: [
            {
              src: "/images/android-icon-36x36.png",
              sizes: "36x36",
              type: "image/png",
            },
            {
              src: "/images/android-icon-48x48.png",
              sizes: "48x48",
              type: "image/png",
            },
            {
              src: "/images/android-icon-72x72.png",
              sizes: "72x72",
              type: "image/png",
            },
            {
              src: "/images/android-icon-144x144.png",
              sizes: "144x144",
              type: "image/png",
            },
            {
              src: "/apple-icon.png",
              sizes: "192x192",
              type: "image/png",
            },
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
              icons: [
                {
                  src: "images/home.png",
                  sizes: "64x64",
                  type: "image/png",
                },
              ],
            },
            {
              name: "Garden",
              description: "Upload your work",
              url: "/garden",
              icons: [
                {
                  src: "images/work.png",
                  sizes: "64x64",
                  type: "image/png",
                },
              ],
            },
            {
              name: "Profile",
              description: "View your profile",
              url: "/profile",
              icons: [
                {
                  src: "images/profile.png",
                  sizes: "64x64",
                  type: "image/png",
                },
              ],
            },
          ],
          related_applications: [
            {
              platform: "webapp",
              url: "https://localhost:3001/manifest.webmanifest",
            },
          ],
          categories: [],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, './src'),
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
  };
});
