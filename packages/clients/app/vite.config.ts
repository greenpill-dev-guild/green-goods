import { defineConfig } from "vite";

import svgr from "vite-plugin-svgr";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import react from "@vitejs/plugin-react";

/**
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  /**
   * Defines global constant replacments
   * @see https://vitejs.dev/config/shared-options.html#define
   */
  define: {
    global: "globalThis",
  },
  resolve: {
    /**
     * Polyfills nodejs imports
     * @see https://vitejs.dev/config/shared-options.html#resolve-alias
     */
    alias: {
      process: "process/browser",
      util: "util",
    },
  },
  plugins: [
    react(),
    mkcert(),
    //@ts-ignore
    svgr({
      svgrOptions: {
        namedExport: "RC",
      },
    }),
    VitePWA({
      includeAssets: [
        "assets/favicon.ico",
        "assets/logo-64.png",
        "assets/logo-310.png",
        "assets/world.png",
        "assets/profile.png",
      ],
      injectRegister: "auto",
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
      manifest: {
        name: "Dapp",
        short_name: "Dapp",
        icons: [
          {
            src: "assets/logo-64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "assets/logo-310.png",
            sizes: "192X192",
            type: "image/png",
          },
          {
            src: "assets/logo-310.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
        start_url: "/",
        scope: "/",
        display: "fullscreen",
        orientation: "portrait-primary",
        theme_color: "#fff",
        background_color: "#000",
        shortcuts: [
          {
            name: "Profile",
            description: "View your profile",
            url: "/profile",
            icons: [
              {
                src: "assets/profile.png",
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
  server: {
    port: 3001,
  },
});
