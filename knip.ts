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
        "playwright.config.ts",
      ],
      // PM2 loads ecosystem.config.cjs directly. Disable Knip's PM2 plugin so
      // dead-code analysis never executes that config's root-env bootstrap.
      pm2: false,
      ignore: [
        // PM2 remains this external config's durable caller; the disabled plugin
        // above keeps Knip from executing it during analysis.
        "ecosystem.config.cjs",
        // Ambient type declarations for env-parity.mjs, which both Vite configs
        // import. Consumed by tsc, never by a runtime import.
        "scripts/lib/env-parity.d.mts",
      ],
      ignoreDependencies: [
        // PM2 runtime dependency
        "pm2",
        // Invoked as CLI binaries from package.json scripts or shell scripts,
        // never imported: upload-sourcemaps.js, agentic:guidance,
        // per-package `lint`, and scripts/dev/open-urls.sh respectively.
        "@posthog/cli",
        "modern-web-guidance",
        "oxlint",
        "wait-port",
        // Imported by packages/client/vite.config.ts but declared here, so the
        // importer and the declaration sit in different workspaces.
        "vite-plugin-mkcert",
        // Pinned for version alignment with the tools that resolve them:
        // graphql arrives through msw, lighthouse through @lhci/cli.
        "graphql",
        "lighthouse",
      ],
    },
    "packages/shared": {
      ignore: [
        // Passed to vitest as `--config` by scripts/dev/run-storybook-vitest-ci.mjs
        "vitest.storybook.config.ts",
        // Manually-invoked Storybook screenshot pipeline for design exports.
        // No durable caller by design — see .plans/archive/admin-claude-design-export/.
        ".storybook/capture-admin-stories.mjs",
      ],
      entry: [
        "src/index.ts",
        "src/commitment-pooling/index.ts",
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
        // Registered with VitePWA as an `importScripts` string in vite.config.ts,
        // so no import graph reaches it. Covered by its own test.
        "public/sw-custom.js",
        // Staged card on-ramp for vault crowdfunding — deliberately not wired
        // into the live (wallet-only) checkout until card funding ships. Each
        // file documents the park and its unpark condition in its header.
        // Listed here so dead-code sweeps stop re-reporting a deliberate park.
        "src/components/Public/VaultCardEndowFlow.tsx",
        "src/components/Public/VaultCardPaymentPanel.tsx",
        "src/components/Public/VaultCardWalletManage.calls.ts",
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
    "packages/qa": {
      // The build script and the Vercel function are both entry points reached
      // by platform convention (vercel.json buildCommand, the api/ directory),
      // never by an import from elsewhere in the monorepo.
      entry: ["build.mjs", "dev.mjs", "api/*.ts"],
    },
    "packages/agent": {
      entry: ["src/index.ts"],
      ignoreDependencies: [
        // Referenced as a pino transport `target` string in services/logger.ts,
        // which is resolved at runtime rather than imported.
        "pino-pretty",
      ],
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
