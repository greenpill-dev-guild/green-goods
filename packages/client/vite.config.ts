/// <reference types="vitest" />
import path from "path";
import dotenvExpand from "dotenv-expand";

import mkcert from "vite-plugin-mkcert";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

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
          maximumFileSizeToCacheInBytes: 5097152,
          // globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
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
              url: "/profile",
              icons: [
                {
                  src: "images/home.png",
                  sizes: "64x64",
                  type: "image/png",
                },
              ],
            },
            {
              name: "Work",
              description: "Upload your work",
              url: "/profile",
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
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3001,
      proxy: {
        graphql: {
          target: "https://indexer.dev.hyperindex.xyz/332f54b/v1/graphql",
          changeOrigin: true,
        },
      },
    },
  };
});
