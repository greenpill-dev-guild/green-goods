import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15000,
    pool: "threads",
    isolate: true,
    env: {
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
      ],
    },
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["node_modules/", "dist/"],
  },
});
