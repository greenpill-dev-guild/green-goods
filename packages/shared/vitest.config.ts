import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setupTests.ts"],
    globals: true,
    testTimeout: 10000,
    pool: "forks",
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "src/__mocks__/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/types/**",
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

