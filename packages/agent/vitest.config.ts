import { defineConfig } from "vitest/config";
import path from "path";

const sqliteIntegration = process.env.AGENT_SQLITE_INTEGRATION === "true";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: sqliteIntegration ? [] : ["./src/__tests__/setup.ts"],
    include: sqliteIntegration
      ? ["src/__tests__/storage.sqlite.test.ts"]
      : ["src/__tests__/**/*.test.ts"],
    exclude: [
      "node_modules/",
      "**/*.test.skip.ts",
      ...(sqliteIntegration ? [] : ["**/*.sqlite.test.ts"]),
    ],
    // Set test environment variables at config level
    env: {
      NODE_ENV: "test",
      ENCRYPTION_SECRET: "test-secret-key-for-encryption-32chars!",
      TELEGRAM_BOT_TOKEN: "123456:ABC-TEST-TOKEN",
      VITE_RPC_URL_11155111: "http://localhost:3009",
    },
    // Each unit-test file runs in an isolated worker. The real SQLite lane stays
    // serial so it owns one on-disk database lifecycle at a time.
    fileParallelism: !sqliteIntegration,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "node_modules/",
        "src/**/*.d.ts",
        "src/__tests__/**",
        "src/index.ts",
        "src/types.ts",
      ],
      thresholds: {
        branches: 10,
        functions: 20,
        lines: 20,
        statements: 20,
      },
    },
    // Increase timeout for database tests
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@green-goods/shared/sentry-redaction": path.resolve(
        __dirname,
        "../shared/src/modules/app/sentry-redaction.ts"
      ),
      "@green-goods/shared": path.resolve(__dirname, "../shared/src"),
      "node:diagnostics_channel": path.resolve(
        __dirname,
        "../shared/src/__mocks__/node/diagnostics-channel.ts"
      ),
      diagnostics_channel: path.resolve(
        __dirname,
        "../shared/src/__mocks__/node/diagnostics-channel.ts"
      ),
    },
  },
});
