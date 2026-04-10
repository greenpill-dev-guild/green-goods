import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: [
        "**/node_modules/**",
        "src/__tests__/workflows/unauthorized-actions.test.tsx",
        "src/__tests__/components/WithdrawModal.test.tsx",
      ],
    },
  })
);
