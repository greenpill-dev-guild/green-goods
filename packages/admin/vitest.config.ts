/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { availableParallelism, totalmem } from "node:os";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

import { resolveVitestMaxWorkers } from "../../scripts/lib/dev-shared.js";

const localReactPath = resolve(__dirname, "./node_modules/react");
const localReactDomPath = resolve(__dirname, "./node_modules/react-dom");
const nodeTestFiles = "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}";
const domTestFiles = "src/**/*.{test,spec}.{jsx,tsx}";

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
      // Mirrors vite.config.ts: the boot sequence loads Sentry through the
      // declared `./sentry` subpath, which the generic prefix alias below
      // would otherwise resolve to a non-existent `src/sentry`.
      {
        find: "@green-goods/shared/sentry",
        replacement: resolve(__dirname, "../shared/src/modules/app/sentry.ts"),
      },
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
        find: "@green-goods/shared/i18n",
        replacement: resolve(__dirname, "../shared/src/i18n"),
      },
      {
        find: "@green-goods/shared/workflows",
        replacement: resolve(__dirname, "../shared/src/workflows"),
      },
      {
        find: "@green-goods/shared/constants",
        replacement: resolve(__dirname, "../shared/src/constants"),
      },
      {
        find: "@green-goods/shared/testing",
        replacement: resolve(__dirname, "../shared/src/__tests__/test-utils"),
      },
      {
        find: "@green-goods/shared/commitment-pooling",
        replacement: resolve(__dirname, "../shared/src/commitment-pooling"),
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
    exclude: [
      "**/node_modules/**",
    ],
    coverage: {
      provider: "v8",
      reporter: process.env.CI ? ["text", "json"] : ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "src/**/*.stories.{ts,tsx}",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
      ],
      thresholds: {
        branches: 47,
        functions: 44,
        lines: 53,
        statements: 51,
      },
    },
    pool: "threads",
    maxWorkers: resolveVitestMaxWorkers({
      cpus: availableParallelism(),
      totalMemoryBytes: totalmem(),
      ci: Boolean(process.env.CI),
    }),
    isolate: true,
    server: {
      deps: {
        inline: [
          "multiformats",
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
          // zod v4 ESM-only exports need inline pipeline for SSR named imports.
          "zod",
        ],
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
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
});
