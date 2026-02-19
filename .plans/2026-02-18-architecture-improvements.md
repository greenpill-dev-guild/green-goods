# Architecture Improvements: B+ → A

## Context

The architecture review identified four gaps preventing an A grade:
1. Shared package exports ~647 symbols through a single barrel — all 132 consumer files use root imports
2. Two files in shared cross the package boundary via `../../../../contracts/` relative paths
3. ABIs come from two sources (gitignored forge `out/` + hand-written `abis.ts`) with overlap
4. Indexer config has stale addresses for Arbitrum and Sepolia; sync/verifier contract lists don't match

## Implementation Order

```
Phase 1: Indexer Drift Fix (independent, immediate value)
Phase 2: ABI Extraction (creates contracts/abis/)
Phase 3: Artifact Pipeline (workspace dep, uses contracts/abis/ from Phase 2)
Phase 4: Subpath Import Migration (132-file codemod + lint rule)
```

Phases 1 and 2 are independent and can be done in parallel. Phase 3 depends on Phase 2. Phase 4 is independent of 1-3.

---

## Phase 1: Fix Indexer Drift + CI Guard

**Files to modify:**
- `packages/contracts/script/utils/envio-integration.ts` — expand `INDEXER_MANAGED_CONTRACT_ORDER` and add 5 new `upsertContract` calls
- `packages/indexer/config.yaml` — updated by running the sync script
- `packages/contracts/script/utils/post-deploy-verify.ts` — no changes needed (verifier already checks the 11 contracts)

**Steps:**

1. Add 5 missing contracts to `INDEXER_MANAGED_CONTRACT_ORDER` (line 49): `GardensModule`, `CookieJarModule`, `GreenGoodsENS`, `HypercertMarketplaceAdapter`, `UnifiedPowerRegistry`

2. Add corresponding `upsertContract` calls (after line 262):
   ```typescript
   upsertContract("GardensModule", deployment.gardensModule);
   upsertContract("CookieJarModule", deployment.cookieJarModule);
   upsertContract("GreenGoodsENS", deployment.greenGoodsENS);
   upsertContract("HypercertMarketplaceAdapter", deployment.marketplaceAdapter);
   upsertContract("UnifiedPowerRegistry", deployment.unifiedPowerRegistry);
   ```

3. Run sync for drifted chains:
   ```bash
   cd packages/contracts
   bun script/utils/envio-integration.ts update 42161
   bun script/utils/envio-integration.ts update 11155111
   ```

4. Add CI step to `contracts-tests.yml` that validates indexer config alignment (runs `validateIndexerConfig` from post-deploy-verify.ts against each chain's deployment JSON — read-only, no RPC needed)

**Verification:** Diff the config.yaml before/after to confirm addresses match deployment JSONs.

---

## Phase 2: ABI Extraction

**Goal:** Extract ABI arrays from forge `out/` into committed `contracts/abis/` directory, eliminating imports from gitignored build artifacts.

**New files:**
- `packages/contracts/abis/` — directory with 6 JSON files (committed)
- `packages/contracts/script/build-abis.ts` — extraction script

**Steps:**

1. Create `packages/contracts/script/build-abis.ts`:
   - Reads 6 contracts from `out/` directory: `Garden.sol/GardenToken`, `Garden.sol/GardenAccount`, `Action.sol/ActionRegistry`, `EAS.sol/MockEAS`, `ENS.sol/GreenGoodsENS`, `IHats.sol/IHats`
   - Extracts just the `.abi` array from each JSON
   - Writes to `abis/{ContractName}.json` (e.g., `abis/GardenToken.json`)
   - Idempotent — re-running produces identical output if contracts haven't changed

2. Add to `packages/contracts/package.json` scripts:
   ```json
   "build:abis": "bun script/build-abis.ts"
   ```

3. Run once to generate initial files, commit them

4. Remove the `GARDEN_ACCOUNT_ROLE_ABI` overlap from `shared/src/utils/blockchain/abis.ts` — those 6 role-checking functions exist in the full GardenAccount ABI. Consumers of the role ABI should switch to importing the full ABI from the new path (done in Phase 3).

**Verification:** `diff <(jq '.abi' contracts/out/Garden.sol/GardenToken.json) contracts/abis/GardenToken.json` for each contract.

---

## Phase 3: Artifact Pipeline (Workspace Dependency)

**Goal:** Replace `../../../../contracts/` relative path escapes with clean `@green-goods/contracts/` workspace imports.

**Files to modify:**
- `packages/contracts/package.json` — add `exports` field
- `packages/shared/package.json` — add workspace dependency
- `packages/shared/src/config/blockchain.ts` — update 5 import paths
- `packages/shared/src/utils/blockchain/contracts.ts` — update 9 import paths (3 deployments + 6 ABIs)
- `packages/client/vite.config.ts` — add 2 Vite aliases for contracts
- `packages/admin/vite.config.ts` — add 2 Vite aliases for contracts
- `packages/client/tsconfig.app.json` — add 2 path mappings for contracts
- `packages/admin/tsconfig.app.json` — add 2 path mappings for contracts

**Steps:**

1. Add `exports` to `packages/contracts/package.json`:
   ```json
   "exports": {
     "./deployments/*": "./deployments/*.json",
     "./abis/*": "./abis/*.json"
   }
   ```

2. Add workspace dependency in `packages/shared/package.json`:
   ```json
   "dependencies": {
     "@green-goods/contracts": "workspace:*"
   }
   ```
   Run `bun install` to update lockfile.

3. Update `shared/src/config/blockchain.ts` imports:
   ```typescript
   // Before: import deployment31337 from "../../../contracts/deployments/31337-latest.json";
   // After:
   import deployment31337 from "@green-goods/contracts/deployments/31337-latest.json";
   ```
   (Same for all 5 JSON imports in this file)

4. Update `shared/src/utils/blockchain/contracts.ts` imports:
   ```typescript
   // Before: import GardenTokenABIJson from "../../../../contracts/out/Garden.sol/GardenToken.json";
   // After:
   import GardenTokenABIJson from "@green-goods/contracts/abis/GardenToken.json";
   ```
   (Same for all 3 deployment JSONs and 6 ABI JSONs — 9 imports total)

5. Add Vite aliases in both `client/vite.config.ts` and `admin/vite.config.ts`:
   ```typescript
   "@green-goods/contracts/deployments": resolve(__dirname, "../contracts/deployments"),
   "@green-goods/contracts/abis": resolve(__dirname, "../contracts/abis"),
   ```

6. Add tsconfig path mappings in both `client/tsconfig.app.json` and `admin/tsconfig.app.json`:
   ```json
   "@green-goods/contracts/deployments/*": ["../contracts/deployments/*.json"],
   "@green-goods/contracts/abis/*": ["../contracts/abis/*.json"]
   ```

7. No changes needed for agent (it doesn't import contracts directly — it uses shared hooks).

**Verification:** `bun build` in root succeeds, `bun run test` passes, `bun dev` starts both frontends.

---

## Phase 4: Subpath Import Migration

**Goal:** Migrate all 132 consumer files from root barrel to category-specific subpath imports. Add lint enforcement.

**New files:**
- `scripts/migrate-shared-imports.ts` — one-time codemod script

**Files to modify:**
- 66 files in `packages/client/src/`
- 62 files in `packages/admin/src/`
- 4 files in `packages/agent/src/`
- `packages/shared/package.json` — add `./lib/hypercerts` subpath export
- `packages/shared/src/index.ts` — add deprecation comment
- `packages/agent/tsconfig.json` — add path mappings for shared subpaths
- `packages/client/vite.config.ts` — add `./lib/hypercerts` alias
- `packages/admin/vite.config.ts` — add `./lib/hypercerts` alias
- `packages/client/tsconfig.app.json` — add `./lib/hypercerts` path
- `packages/admin/tsconfig.app.json` — add `./lib/hypercerts` path
- `.oxlintrc.json` — add `no-restricted-imports` rule
- `.claude/rules/typescript.md` — update Rule 11 to enforce subpath imports

**Steps:**

1. Add missing subpath export to `shared/package.json`:
   ```json
   "./lib/hypercerts": "./src/lib/hypercerts/index.ts"
   ```
   Add corresponding Vite aliases and tsconfig paths in client/admin.

2. Write the codemod script `scripts/migrate-shared-imports.ts`:
   - Build symbol→subpath map by reading each sub-barrel index file (`hooks/index.ts`, `types/index.ts`, etc.)
   - For each consumer file: parse imports from `@green-goods/shared`, look up each symbol's category, group by subpath, rewrite as multiple imports
   - Preserve `import type` vs `import` distinction
   - Dry-run mode for verification before committing

3. Add tsconfig path mappings to `packages/agent/tsconfig.json` for shared subpaths (hooks, types, utils, modules, config). Agent uses `moduleResolution: "bundler"` without `resolvePackageJsonExports`, same as the frontends.

4. Run the codemod:
   ```bash
   bun scripts/migrate-shared-imports.ts --dry-run  # verify first
   bun scripts/migrate-shared-imports.ts             # apply
   ```

5. Add oxlint `no-restricted-imports` rule to `.oxlintrc.json`:
   ```json
   "no-restricted-imports": ["error", {
     "paths": [{
       "name": "@green-goods/shared",
       "message": "Import from a subpath instead: @green-goods/shared/hooks, /types, /utils, /components, /config, /modules, /providers, /stores, /workflows, /i18n, /lib/hypercerts"
     }]
   }]
   ```
   (Note: verify oxlint supports this rule — if not, use a script-based check in CI instead)

6. Update Rule 11 in `.claude/rules/typescript.md` to invert the convention:
   ```
   Always import from subpath exports, never the root barrel.
   ```

7. Add deprecation notice to `shared/src/index.ts`:
   ```typescript
   /** @deprecated Import from subpath instead: @green-goods/shared/hooks, /types, /utils, etc. */
   ```

**Target subpath categories (11):**
- `@green-goods/shared/hooks` — React hooks (~85 files use these)
- `@green-goods/shared/types` — Domain types, enums (~40 files)
- `@green-goods/shared/utils` — Utilities, cn(), formatAddress, ABIs (~50 files)
- `@green-goods/shared/components` — Shared UI components (~20 files)
- `@green-goods/shared/config` — Chain config, query client, SDG targets (~15 files)
- `@green-goods/shared/modules` — Data modules, logger, analytics (~12 files)
- `@green-goods/shared/providers` — React providers (~6 files)
- `@green-goods/shared/stores` — Zustand stores (~8 files)
- `@green-goods/shared/workflows` — XState machines (~2 files)
- `@green-goods/shared/i18n` — Locale files (~2 files)
- `@green-goods/shared/lib/hypercerts` — Hypercert utils (~3 files)

**Verification:** `bun lint` blocks root barrel imports, `bun build` succeeds, `bun run test` passes.

---

## End-to-End Verification

After all 4 phases:
```bash
bun install                  # lockfile update from workspace dep
bun format && bun lint       # new lint rule catches regressions
bun run test                 # all packages
bun build                    # full workspace build
bun dev                      # start all services, verify HMR works
```
