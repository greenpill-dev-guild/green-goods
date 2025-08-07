/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenvExpand from "dotenv-expand";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from monorepo root first, then local overrides
  const rootDir = resolve(__dirname, "../../"); // Go up to monorepo root

  // 1. Load from monorepo root .env files (foundation)
  const rootEnv = loadEnv(mode, rootDir, "");
  dotenvExpand.expand({ parsed: rootEnv });

  // 2. Load from package-specific .env files (overrides)
  const localEnv = loadEnv(mode, __dirname, "");
  dotenvExpand.expand({ parsed: localEnv });

  // Debug: Log loaded variables (remove these lines in production)
  const rootViteVars = Object.keys(rootEnv).filter((k) => k.startsWith("VITE_"));
  const localViteVars = Object.keys(localEnv).filter((k) => k.startsWith("VITE_"));

  if (rootViteVars.length > 0) {
    console.log(`🌍 Root environment: ${rootViteVars.length} VITE_ variables loaded`);
  }
  if (localViteVars.length > 0) {
    console.log(`📱 Local overrides: ${localViteVars.length} VITE_ variables loaded`);
  }

  return {
    // Environment configuration
    envDir: rootDir, // Primary lookup directory (monorepo root)
    envPrefix: ["VITE_", "PRIVY_", "SKIP_"], // Include test/build prefixes beyond VITE_

    // REMOVE THESE LINES - they conflict with vitest.config.ts
    // test: {
    //   env: loadEnv(mode, process.cwd(), ""),
    //   environment: "jsdom",
    //   setupFiles: "./src/__tests__/setupTests.ts", // Optional: setup file
    // },
    build: {
      target: "es2020",
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
          enabled: false, // Disable SW in dev to prevent HMR issues
        },
        workbox: {
          // Increase the limit to handle larger bundles (10 MB)
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          // Only cache smaller, essential files in the service worker
          globPatterns: [
            "**/*.{html,ico,png,svg}",
            "**/assets/*.css",
            // Exclude the largest JS bundles from SW precaching
            "!**/assets/*-{index,vendor,crypto,wallet}*.js",
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
            // Cache images for offline viewing
            {
              urlPattern: /.*\.(png|jpg|jpeg|svg|gif|webp)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "image-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Cache API responses for offline
            {
              urlPattern: /^https:\/\/api\.pinata\.cloud/,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Cache GraphQL responses
            {
              urlPattern: /graphql/,
              handler: "NetworkFirst",
              options: {
                cacheName: "graphql-cache",
                networkTimeoutSeconds: 5,
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
        "@": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3001,
      host: true,
      hmr: {
        overlay: true, // Show HMR errors in overlay
      },
      watch: {
        usePolling: true, // Better file watching on some systems
        interval: 100,
      },
    },
  };
});
