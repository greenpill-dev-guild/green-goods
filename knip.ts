import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      // Scripts are entry points at every depth: their durable callers are
      // shell scripts, CI workflow steps, .mcp.json, and Claude skills, none
      // of which knip can resolve. Script deadness is gated by the
      // durable-caller rule in CLAUDE.md § Scripts plus the required
      // scripts/README.md entry, not by import analysis.
      entry: [
        "scripts/**/*.{ts,js,mjs,cjs}",
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
        "src/ontology/index.ts",
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
      ignore: [
        // Staged card on-ramp for vault crowdfunding — deliberately not wired
        // into the live (wallet-only) checkout until card funding ships. Each
        // file documents the park and its unpark condition in its header.
        // Listed here so dead-code sweeps stop re-reporting a deliberate park.
        "src/components/Public/VaultCardEndowFlow.tsx",
        "src/components/Public/VaultCardPaymentPanel.tsx",
        "src/components/Public/VaultCardWalletManage.tsx",
      ],
      ignoreDependencies: [
        // Card on-ramp SDK — only consumed by the staged card flow above
        "thirdweb",
        // Declared in packages/shared, resolved here through workspace hoisting
        "@storybook/react",
        "storybook",
      ],
    },
    "packages/admin": {
      entry: ["src/main.tsx"],
      ignoreDependencies: [
        // Declared in packages/shared, resolved here through workspace hoisting
        "@storybook/react",
        "storybook",
      ],
    },
    "packages/agent": {
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
      ignoreDependencies: [
        // Consumed by Solidity through remappings.txt, which TS analysis
        // cannot resolve. Verify against remappings.txt before removing any.
        "@chainlink/contracts-ccip",
        "@ethereum-attestation-service/eas-contracts",
        "@openzeppelin/contracts-5.0.2",
        "@openzeppelin/contracts-upgradeable",
      ],
    },
    docs: {
      // Docusaurus site — skip TS analysis
      entry: ["docusaurus.config.ts", "src/**/*.{ts,tsx}"],
      ignoreDependencies: [
        // Re-exported by @docusaurus/preset-classic, not declared directly
        "@docusaurus/plugin-content-docs",
      ],
    },
  },
  ignore: [
    // Plan hubs are sanctioned scratch space, not shipped source
    ".plans/**",
    // Foundry git submodules
    "packages/contracts/lib/**",
    // Build outputs
    "packages/*/dist/**",
    "packages/contracts/.generated/**",
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
