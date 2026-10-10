import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "script",
    environment: "node",
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
