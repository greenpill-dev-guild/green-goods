import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    exclude: [
      "node_modules/",
      "**/*.test.skip.ts",
    ],
    // Set test environment variables at config level
    env: {
      NODE_ENV: "test",
      ENCRYPTION_SECRET: "test-secret-key-for-encryption-32chars!",
      TELEGRAM_BOT_TOKEN: "123456:ABC-TEST-TOKEN",
      VITE_RPC_URL_11155111: "http://localhost:8545",
    },
    // Run tests sequentially to avoid env variable issues
    fileParallelism: false,
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
        branches: 20,
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
      "@green-goods/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
});
