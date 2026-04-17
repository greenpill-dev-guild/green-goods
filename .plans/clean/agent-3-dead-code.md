# Agent 3: Dead Code Removal Findings

## STATUS: IMPLEMENTED
All HIGH-CONFIDENCE items removed. Tests pass (no new regressions).
Pre-existing failures in yield hooks (12 tests) and admin DepositModal/GardenYieldCard (3 tests) unrelated to changes.

## HIGH-CONFIDENCE (verified unused, safe to remove)

### Unused Files
1. **`.claude/scripts/check-i18n-completeness.mjs`** - Only referenced in skill docs, never executed
2. **`packages/admin/src/components/Vault/funderTotals.ts`** - No imports anywhere
3. **`packages/admin/src/styles/main-rail-layout.css`** - No imports anywhere
4. **`packages/admin/src/views/Endowments/GardenVaultCard.tsx`** - Only self-references within Endowments dir
5. **`packages/admin/src/views/Endowments/ImpactFundersDialog.tsx`** - Only self-references within Endowments dir
6. **`packages/admin/src/views/Endowments/ImpactFundersSidebar.tsx`** - Only self-references within Endowments dir
7. **`packages/admin/src/views/Endowments/MyPositionsSidebar.tsx`** - Only self-references within Endowments dir
8. **`packages/agent/src/__tests__/utils/factories.ts`** - Never imported by any test
9. **`packages/agent/src/api/index.ts`** - Barrel file; all imports go directly to ./server
10. **`packages/agent/src/platforms/index.ts`** - Barrel file; all imports go directly to ./telegram
11. **`packages/agent/src/services/index.ts`** - Barrel file; all imports go directly to specific service files
12. **`packages/shared/src/hooks/work/useWorkMetadata.ts`** - Never imported; hook functionality covered elsewhere
13. **`packages/shared/src/__tests__/utils/ens.test.skip.ts`** - Skipped test, expired 2026-03-17
14. **`packages/shared/src/__tests__/utils/text.test.skip.ts`** - Skipped test, expired 2026-03-17

### Unused Exports (barrel re-exports)
1. **`packages/admin/src/components/Vault/index.ts`**: `FunderRow` - exported but never imported via barrel
2. **`packages/admin/src/components/ui/Button.tsx`**: `buttonVariants` - never imported externally
3. **`packages/admin/src/components/ui/Card.tsx`**: `cardVariants` - never imported externally
4. **`packages/admin/src/components/ui/StatusBadge.tsx`**: `statusBadgeVariants` - never imported externally
5. **`packages/shared/src/providers/Auth.tsx`**: re-export of `AuthMode` - redundant (already exported via types/auth.ts)

### Unused DevDependencies
1. **`packages/agent/package.json`**: `tsx` - agent scripts all use `bun`, not tsx
2. **`packages/agent/package.json`**: `@faker-js/faker` - only used in factories.ts which is itself unused

### Unused Enum Members
1. **`packages/shared/src/types/contracts.ts`**: `Exponential`, `Power` in `WeightScheme` - never referenced

## MEDIUM (likely unused but needs judgment)

### Unused Files
1. **`channels/gdrive/server.ts`** - Standalone GDrive MCP server; memory note says NOT registered in .mcp.json. May be intentionally kept for future use.
2. **`packages/indexer/test/test.ts`** - Used by mocha test script (`test/**/*.ts` glob). NOT UNUSED. Knip false positive.

### Unused Dependencies
1. **`package.json`**: `@tailwindcss/forms`, `@tailwindcss/postcss`, `@tailwindcss/typography` - TW v4 doesn't use PostCSS plugins; likely legacy
2. **`package.json`**: `tailwindcss-animate` - Not imported anywhere in code
3. **`package.json`**: `sharp` - Listed in package.json but never imported in any TS file; may be used as a CLI tool
4. **`package.json`**: `tsc-alias` - Not used in any script
5. **`package.json`**: `wait-port` - Not used in any script
6. **`packages/admin/package.json`**: `babel-plugin-react-compiler` - Used in vite.config but also in root; may be hoisted
7. **`packages/client/package.json`**: `babel-plugin-react-compiler` - Used in vite.config but also in root; may be hoisted

### Unused Exports (shared types/hooks)
These are type-only exports used for public API surface. Removing them risks breaking downstream consumers:
- Various `*Props` types in client components
- Various `*Params` types in shared hooks
- Various `*Return` types in shared hooks

## LOW (possibly used dynamically or in config)

### False Positives (NOT removing)
1. **`docs/src/css/custom.css`** - Referenced in docusaurus.config.ts. NOT unused.
2. **`packages/client/public/sw-custom.js`** - Referenced in vite.config.ts importScripts. NOT unused.
3. **`packages/indexer/test/test.ts`** - Picked up by mocha glob. NOT unused.
4. **`package.json`**: `uint8arrays` - Used in vitest configs and mock setups
5. **`packages/admin/package.json`**: `@reown/appkit` - Used in test mocks
6. **`packages/client/package.json`**: `@reown/appkit` - Used in test setup
7. **`packages/agent/package.json`**: `pino-pretty` - Used as pino transport in logger.ts
8. **`packages/contracts/package.json`**: All listed deps - Used by Solidity source files
9. **`package.json`**: `lint-staged` - Used in lint-staged config in package.json
10. **`package.json`**: `lighthouse` - Used in .lighthouserc.json and CI scripts
11. **`package.json`**: `oxlint` - Used in .oxlintrc.json and package lint scripts
12. **`package.json`**: `graphql` - Used across shared modules
13. **`package.json`**: `vite-plugin-mkcert` - Used in vite.config.ts files
14. **`package.json`**: `babel-plugin-react-compiler` - Used in vite.config.ts files
15. **`package.json`**: `@varlock/1password-plugin` - Varlock plugin, loaded by config
16. **`package.json`**: `@types/qrcode` - Types for qrcode.react used in client
17. **Test utilities** (`packages/admin/src/__tests__/test-utils.tsx`, `packages/agent/src/__tests__/utils/mocks.ts`) - Used by test files; knip doesn't trace test imports well
