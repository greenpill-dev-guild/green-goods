/// <reference types="vitest" />

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, "./src") },
      // Force React to resolve to the root node_modules to prevent multiple instances
      {
        find: /^react$/,
        replacement: resolve(__dirname, "../../node_modules/react"),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(__dirname, "../../node_modules/react/jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(__dirname, "../../node_modules/react/jsx-dev-runtime.js"),
      },
      {
        find: /^react-dom$/,
        replacement: resolve(__dirname, "../../node_modules/react-dom"),
      },
      {
        find: /^react-dom\/client$/,
        replacement: resolve(__dirname, "../../node_modules/react-dom/client.js"),
      },
      // Shared package aliases
      {
        find: "@green-goods/shared/hooks",
        replacement: resolve(__dirname, "../shared/src/hooks"),
      },
      {
        find: "@green-goods/shared/providers",
        replacement: resolve(__dirname, "../shared/src/providers"),
      },
      {
        find: "@green-goods/shared/modules",
        replacement: resolve(__dirname, "../shared/src/modules"),
      },
      {
        find: "@green-goods/shared/utils",
        replacement: resolve(__dirname, "../shared/src/utils"),
      },
      {
        find: "@green-goods/shared/config",
        replacement: resolve(__dirname, "../shared/src/config"),
      },
      {
        find: "@green-goods/shared/types",
        replacement: resolve(__dirname, "../shared/src/types"),
      },
      {
        find: "@green-goods/shared/stores",
        replacement: resolve(__dirname, "../shared/src/stores"),
      },
      {
        find: "@green-goods/shared/mocks",
        replacement: resolve(__dirname, "../shared/src/__mocks__"),
      },
      {
        find: "@green-goods/shared/components",
        replacement: resolve(__dirname, "../shared/src/components"),
      },
      {
        find: "@green-goods/shared/testing",
        replacement: resolve(__dirname, "../shared/src/__tests__/test-utils"),
      },
      {
        find: "@green-goods/shared",
        replacement: resolve(__dirname, "../shared/src"),
      },
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
