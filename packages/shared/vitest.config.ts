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
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "../../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
      "react-dom/client": path.resolve(__dirname, "../../node_modules/react-dom/client.js"),
      "react/jsx-runtime": path.resolve(__dirname, "../../node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "../../node_modules/react/jsx-dev-runtime.js"),
      // Force any nested react-intl import of React to use the root copy
      "react-intl/node_modules/react": path.resolve(__dirname, "../../node_modules/react"),
    },
  },
});

