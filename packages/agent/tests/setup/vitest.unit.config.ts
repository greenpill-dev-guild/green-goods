import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "unit",
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup/unit.setup.ts"],
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/index.ts", "src/types.ts"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
    },
  },
});
