/// <reference types="vitest" />

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const localReactPath = resolve(__dirname, "./node_modules/react");
const localReactDomPath = resolve(__dirname, "./node_modules/react-dom");

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "multiformats", "uint8arrays"],
    alias: [
      { find: "@", replacement: resolve(__dirname, "./src") },
      // Force React to resolve to package-local node_modules to prevent multiple instances
      {
        find: /^react$/,
        replacement: localReactPath,
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(localReactPath, "jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(localReactPath, "jsx-dev-runtime.js"),
      },
      {
        find: /^react-dom$/,
        replacement: localReactDomPath,
      },
      {
        find: /^react-dom\/client$/,
        replacement: resolve(localReactDomPath, "client.js"),
      },
      // Mock heavy SDKs to avoid loading their full dependency trees in tests
      {
        find: "@ethereum-attestation-service/eas-sdk",
        replacement: resolve(__dirname, "../shared/src/__mocks__/eas-sdk.ts"),
      },
      {
        find: "@walletconnect/utils",
        replacement: resolve(
          __dirname,
          "../shared/src/__mocks__/walletconnect-utils.ts",
        ),
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
    // Tests that import real view/heavy components trigger full dependency tree
    // resolution (viem, wagmi, etc.) and hang indefinitely. Run them separately
    // with `bun run test:views` once module mocking is fixed.
    exclude: [
      "**/node_modules/**",
      "src/__tests__/views/**",
      "src/__tests__/workflows/unauthorized-actions.test.tsx",
      "src/__tests__/components/WithdrawModal.test.tsx",
    ],
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
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    pool: "threads",
    isolate: true,
    server: {
      deps: {
        inline: [
          "multiformats",
          "@storacha/client",
          "@ethereum-attestation-service/eas-sdk",
          "uint8arrays",
          "react",
          "react-dom",
          "react-intl",
          "react-router",
          "react-router-dom",
          "@testing-library/react",
          "@tanstack/react-query",
          "zustand",
          "viem",
          "wagmi",
          "@walletconnect/utils",
          "@walletconnect/types",
        ],
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
