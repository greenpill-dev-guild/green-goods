import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setupTests.ts"],
    globals: true,
    testTimeout: 10000,
    pool: "threads",
    isolate: false,
    deps: {
      external: [],
      inline: true,
      interopDefault: true,
    },
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
          "@testing-library/react",
          "@tanstack/react-query",
          "viem",
          "wagmi",
          "@walletconnect/utils",
          "@walletconnect/types",
        ],
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
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules/", "dist/", "**/*.d.ts"],
  },
  resolve: {
    dedupe: ["react", "react-dom", "multiformats", "uint8arrays"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mock EAS SDK to avoid multiformats dependency chain in tests
      "@ethereum-attestation-service/eas-sdk": path.resolve(
        __dirname,
        "./src/__mocks__/eas-sdk.ts"
      ),
      // Mock WalletConnect utils to avoid uint8arrays dependency chain in tests
      "@walletconnect/utils": path.resolve(
        __dirname,
        "./src/__mocks__/walletconnect-utils.ts"
      ),
    },
  },
});

