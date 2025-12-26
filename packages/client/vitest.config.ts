import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["multiformats"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setupTests.ts"],
    globals: true,
    server: {
      deps: {
        inline: ["multiformats", "@storacha/client", "@ethereum-attestation-service/eas-sdk"],
      },
    },
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
    conditions: ["import", "module", "browser", "default"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@green-goods/shared": path.resolve(__dirname, "../shared/src"),
      "@green-goods/shared/hooks": path.resolve(__dirname, "../shared/src/hooks"),
      "@green-goods/shared/providers": path.resolve(__dirname, "../shared/src/providers"),
      "@green-goods/shared/modules": path.resolve(__dirname, "../shared/src/modules"),
      "@green-goods/shared/utils": path.resolve(__dirname, "../shared/src/utils"),
      "@green-goods/shared/config": path.resolve(__dirname, "../shared/src/config"),
      "@green-goods/shared/types": path.resolve(__dirname, "../shared/src/types"),
      "@green-goods/shared/stores": path.resolve(__dirname, "../shared/src/stores"),
      "@green-goods/shared/mocks": path.resolve(__dirname, "../shared/src/mocks"),
      "@green-goods/shared/components": path.resolve(__dirname, "../shared/src/components"),
      pino: path.resolve(__dirname, "./src/__mocks__/pino.ts"),
      "node:diagnostics_channel": path.resolve(__dirname, "./src/__mocks__/diagnostics-channel.ts"),
      diagnostics_channel: path.resolve(__dirname, "./src/__mocks__/diagnostics-channel.ts"),
    },
  },
});
