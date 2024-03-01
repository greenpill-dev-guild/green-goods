import path from "path";
import { defineConfig } from "vite";

import svgr from "vite-plugin-svgr";
import mkcert from "vite-plugin-mkcert";
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
      "@": path.resolve(__dirname, "./src"),
      process: "process/browser",
      util: "util",
    },
  },
  plugins: [
    react(),
    mkcert(),
    svgr({
      svgrOptions: {
        namedExport: "RC",
      },
    }),
  ],
  server: {
    port: 3002,
  },
});
