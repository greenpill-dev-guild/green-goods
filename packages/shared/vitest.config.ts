import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vitest/config";

const workspaceRoot = path.resolve(__dirname, "../..");
const workspaceNodeModules = path.join(workspaceRoot, "node_modules");
const rootReactPath = path.join(workspaceNodeModules, "react");
const rootReactDomPath = path.join(workspaceNodeModules, "react-dom");

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasPrefix(from: string, to: string) {
  return {
    find: new RegExp(`^${escapeRegex(from)}(?:/(.*))?$`),
    replacement: `${to}/$1`,
  };
}

const sharedReactSymlinkPath = path.join(__dirname, "node_modules/react");
const sharedReactDomSymlinkPath = path.join(__dirname, "node_modules/react-dom");
const sharedReactRealPath = fs.realpathSync(sharedReactSymlinkPath);
const sharedReactDomRealPath = fs.realpathSync(sharedReactDomSymlinkPath);

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setupTests.ts"],
    globals: true,
    testTimeout: 10000,
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
        external: [],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/",
        "src/__tests__/**",
        "src/__mocks__/**",
        "**/__tests__/**",
        "**/__mocks__/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/types/**",
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
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules/", "dist/", "**/*.d.ts"],
  },
  resolve: {
    dedupe: ["react", "react-dom", "multiformats", "uint8arrays"],
    alias: [
      // Rewrite any resolved shared-package React path (including Bun store realpaths)
      // to the workspace root runtime so hooks always use a single dispatcher.
      aliasPrefix(sharedReactSymlinkPath, rootReactPath),
      aliasPrefix(sharedReactRealPath, rootReactPath),
      aliasPrefix(sharedReactDomSymlinkPath, rootReactDomPath),
      aliasPrefix(sharedReactDomRealPath, rootReactDomPath),
      { find: "react", replacement: rootReactPath },
      { find: "react-dom", replacement: rootReactDomPath },
      { find: "react-dom/client", replacement: path.join(rootReactDomPath, "client.js") },
      { find: "react-dom/test-utils", replacement: path.join(rootReactDomPath, "test-utils.js") },
      { find: "react/jsx-runtime", replacement: path.join(rootReactPath, "jsx-runtime.js") },
      { find: "react/jsx-dev-runtime", replacement: path.join(rootReactPath, "jsx-dev-runtime.js") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Mock EAS SDK to avoid multiformats dependency chain in tests
      {
        find: "@ethereum-attestation-service/eas-sdk",
        replacement: path.resolve(__dirname, "./src/__mocks__/eas-sdk.ts"),
      },
      // Mock WalletConnect utils to avoid uint8arrays dependency chain in tests
      {
        find: "@walletconnect/utils",
        replacement: path.resolve(__dirname, "./src/__mocks__/walletconnect-utils.ts"),
      },
    ],
  },
});
