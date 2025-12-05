import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setupTests.ts"],
    globals: true,
    // Increase timeout for complex tests
    testTimeout: 10000,
    // Fix React 18 concurrent rendering issues
    pool: "forks",
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
      pino: path.resolve(__dirname, "./src/__mocks__/pino.ts"),
      "node:diagnostics_channel": path.resolve(__dirname, "./src/__mocks__/diagnostics-channel.ts"),
      diagnostics_channel: path.resolve(__dirname, "./src/__mocks__/diagnostics-channel.ts"),
    },
  },
});
