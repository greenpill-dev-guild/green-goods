import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: [
        "scripts/*.{ts,js}",
        "ecosystem.config.cjs",
        "playwright.config.ts",
      ],
      ignoreDependencies: [
        // PM2 runtime dependency
        "pm2",
      ],
    },
    "packages/shared": {
      entry: [
        "src/index.ts",
        "src/components/index.ts",
        "src/hooks/index.ts",
        "src/modules/index.ts",
        "src/providers/index.ts",
        "src/stores/index.ts",
        "src/types/index.ts",
        "src/__mocks__/index.ts",
        "src/__mocks__/browser/index.ts",
        "src/__mocks__/server/index.ts",
        ".storybook/main.ts",
        ".storybook/preview.ts",
      ],
    },
    "packages/client": {
      entry: ["src/main.tsx"],
    },
    "packages/admin": {
      entry: ["src/main.tsx"],
    },
    "packages/agent": {
      entry: ["src/index.ts"],
    },
    "packages/ops": {
      entry: ["src/index.ts"],
    },
    "packages/indexer": {
      entry: [
        "src/EventHandlers.ts",
        "src/handlers/*.ts",
      ],
      ignoreDependencies: [
        // Envio runtime provides these
        "generated",
      ],
    },
    "packages/contracts": {
      // Solidity-only package — no TypeScript entry points
      // Deploy/test/upgrade scripts are standalone
      entry: [
        "script/*.{ts,mjs}",
        "script/utils/*.{ts,mjs}",
      ],
    },
    docs: {
      // Docusaurus site — skip TS analysis
      entry: ["docusaurus.config.ts", "src/**/*.{ts,tsx}"],
    },
  },
  ignore: [
    // Foundry git submodules
    "packages/contracts/lib/**",
    // Build outputs
    "packages/*/dist/**",
    "packages/contracts/out/**",
    // Envio generated code
    "packages/indexer/generated/**",
    // Contract deployment artifacts (consumed as JSON imports, not TS)
    "packages/contracts/deployments/**",
  ],
  ignoreDependencies: [
    // Biome handles formatting/linting (invoked via CLI, not imported)
    "@biomejs/biome",
  ],
};

export default config;
