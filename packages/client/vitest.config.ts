import { availableParallelism, totalmem } from "node:os";
import react from "@vitejs/plugin-react";
import path from "path";
import type { PluginOption } from "vite";
import { defineConfig } from "vitest/config";

import { resolveVitestMaxWorkers } from "../../scripts/lib/dev-shared.js";

const nodeTestFiles = "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}";
const domTestFiles = "src/**/*.{test,spec}.{jsx,tsx}";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setupTests.ts"],
    globals: true,
    server: {
      deps: {
        inline: [
          "@ethereum-attestation-service/eas-sdk",
          "uint8arrays",
          "react",
          "react-dom",
          "@testing-library/react",
          "@testing-library/user-event",
          "@testing-library/jest-dom",
          "react-intl",
          "react-router-dom",
          // zod v4 ESM-only exports need inline pipeline for SSR named imports.
          "zod",
        ],
      },
    },
    // Increase timeout for complex tests
    testTimeout: 10000,
    // Use threads to avoid module pollution between tests
    pool: "threads",
    maxWorkers: resolveVitestMaxWorkers({
      cpus: availableParallelism(),
      totalMemoryBytes: totalmem(),
      ci: Boolean(process.env.CI),
    }),
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: process.env.CI ? ["text", "json"] : ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "src/__mocks__/**",
        "src/test-utils/**",
        "src/**/*.stories.{ts,tsx}",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/build/**",
      ],
      thresholds: {
        branches: 56,
        functions: 62,
        lines: 64,
        statements: 63,
      },
    },
    exclude: ["node_modules/", "dist/", "build/", "**/*.d.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [nodeTestFiles],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [domTestFiles],
        },
      },
    ],
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
        find: "@green-goods/shared/i18n",
        replacement: path.resolve(__dirname, "../shared/src/i18n"),
      },
      {
        find: "@green-goods/shared/workflows",
        replacement: path.resolve(__dirname, "../shared/src/workflows"),
      },
      {
        find: "@green-goods/shared/constants",
        replacement: path.resolve(__dirname, "../shared/src/constants"),
      },
      {
        find: "@green-goods/shared/testing",
        replacement: path.resolve(__dirname, "../shared/src/__tests__/test-utils"),
      },
      {
        find: "@green-goods/shared/commitment-pooling",
        replacement: path.resolve(__dirname, "../shared/src/commitment-pooling"),
      },
      {
        find: "@green-goods/shared/public",
        replacement: path.resolve(__dirname, "../shared/src/hooks/public/publicSurfaceState.ts"),
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
      // Mock EAS SDK to avoid multiformats dependency chain in tests
      {
        find: "@ethereum-attestation-service/eas-sdk",
        replacement: path.resolve(__dirname, "../shared/src/__mocks__/eas-sdk.ts"),
      },
      // Mock WalletConnect utils to avoid uint8arrays dependency chain in tests
      {
        find: "@walletconnect/utils",
        replacement: path.resolve(__dirname, "../shared/src/__mocks__/walletconnect-utils.ts"),
      },
    ],
  },
});
