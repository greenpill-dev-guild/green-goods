import { defineConfig } from "vitest/config";

// Node-only unit tests for the spike's pure modules. Browser behavior (WebGPU, WebMCP, the
// extension lifecycle) is measured by the g0 rig against Brave Beta, not by this suite.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 20000,
  },
});
