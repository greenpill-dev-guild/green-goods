import react from "@vitejs/plugin-react";
import path from "path";
import type { PluginOption } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // optimizeDeps: {
  //   include: ["multiformats"],
  // },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setupTests.ts"],
    globals: true,
    server: {
      deps: {
        inline: [
          "multiformats",
          "@storacha/client",
          "@ethereum-attestation-service/eas-sdk",
          "uint8arrays",
          "react",
          "react-dom",
          "@testing-library/react",
          "@testing-library/user-event",
          "@testing-library/jest-dom",
          "react-intl",
          "react-router-dom",
        ],
      },
    },
    // Increase timeout for complex tests
    testTimeout: 10000,
    // Use threads to avoid module pollution between tests
    pool: "threads",
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "src/__mocks__/",
        "src/test-utils/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/build/**",
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules/", "dist/", "build/", "**/*.d.ts"],
  },
  resolve: {
    conditions: ["import", "module", "browser", "default"],
    alias: [
      {
        find: "@green-goods/shared/hooks",
        replacement: path.resolve(__dirname, "../shared/src/hooks"),
      },
      {
        find: "@green-goods/shared/providers",
        replacement: path.resolve(__dirname, "../shared/src/providers"),
      },
      {
        find: "@green-goods/shared/modules",
        replacement: path.resolve(__dirname, "../shared/src/modules"),
      },
      {
        find: "@green-goods/shared/utils",
        replacement: path.resolve(__dirname, "../shared/src/utils"),
      },
      {
        find: "@green-goods/shared/config",
        replacement: path.resolve(__dirname, "../shared/src/config"),
      },
      {
        find: "@green-goods/shared/types",
        replacement: path.resolve(__dirname, "../shared/src/types"),
      },
      {
        find: "@green-goods/shared/stores",
        replacement: path.resolve(__dirname, "../shared/src/stores"),
      },
      {
        find: "@green-goods/shared/mocks",
        replacement: path.resolve(__dirname, "../shared/src/mocks"),
      },
      {
        find: "@green-goods/shared/components",
        replacement: path.resolve(__dirname, "../shared/src/components"),
      },
      {
        find: "@green-goods/shared",
        replacement: path.resolve(__dirname, "../shared/src"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: "pino",
        replacement: path.resolve(__dirname, "../shared/src/__mocks__/node/pino.ts"),
      },
      {
        find: "node:diagnostics_channel",
        replacement: path.resolve(__dirname, "../shared/src/__mocks__/node/diagnostics-channel.ts"),
      },
      {
        find: "diagnostics_channel",
        replacement: path.resolve(__dirname, "../shared/src/__mocks__/node/diagnostics-channel.ts"),
      },
    ],
  },
});
