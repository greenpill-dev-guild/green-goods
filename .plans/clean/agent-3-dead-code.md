# Agent 3 — Dead Code Removal

## Summary
- **Knip raw findings**: 18 files, 55 exports, 78 types, 4 deps, 4 devDeps, 1 enum
- **Verified HIGH-confidence dead**: 10 files (1 dir-cluster + 4 standalone + 1 stylesheet + 4 agent barrels/factories)
- **Removed**: 10 files
- **Tests**: PASS for all suites where the failures match the pre-removal baseline (admin: 3 pre-existing failures in `GardenYieldCard.test.tsx` and `DepositModal.test.tsx`; shared: 13 pre-existing failures in vault/yield/roles hooks; agent: 55 pass). Net regressions from this commit: **0**.

Triage strategy: per the advisor, knip's signal-to-noise on this codebase is low (Solidity imports, Storybook auto-discovery, service-worker registrations, postcss/Tailwind chains, vite config string plugins, varlock CLI scripts, and runtime barrel imports all blind it). Only category-3 orphaned files were promoted to HIGH-confidence — and only after grep + git-log verified each one. Unused-exports and unused-types lists were skipped wholesale per the advisor's guidance: most are barrel re-exports kept for API stability or downstream typing, with zero runtime cost.

## HIGH-confidence removals (implemented)

### Files
- `packages/admin/src/views/Endowments/GardenVaultCard.tsx` — orphan; only self-references in `grep -r "GardenVaultCard"`. Endowments/index.tsx does not import it.
- `packages/admin/src/views/Endowments/ImpactFundersDialog.tsx` — orphan; only imported by `ImpactFundersSidebar.tsx` (also dead). The live Endowments view uses `ImpactFunders` from `@/components/Vault`, not the Dialog/Sidebar pair.
- `packages/admin/src/views/Endowments/ImpactFundersSidebar.tsx` — orphan; only references its own `ImpactFundersDialog` import. Endowments/index.tsx does not import it.
- `packages/admin/src/views/Endowments/MyPositionsSidebar.tsx` — orphan; only self-references. The live Endowments view renders `MyTrackedPositionCard` inline.
- `packages/admin/src/components/Vault/funderTotals.ts` — exposed `formatFunderAssetTotals`, only consumed by the two dead Endowments files (`ImpactFundersDialog.tsx` + `ImpactFundersSidebar.tsx`). Now genuinely unused.
- `packages/admin/src/styles/main-rail-layout.css` — `grep -r "main-rail-layout"` returned only the file's own selector definitions. No `@import`, no JSX class application, no html/build reference.
- `packages/agent/src/__tests__/utils/factories.ts` — `createMockMessage` and `createMockUser` exports are duplicated as **local copies** inside `packages/agent/src/__tests__/handlers.test.ts` (lines 28 + 40). The shared file is genuinely orphaned. (Side effect: `@faker-js/faker` becomes unused in agent — flagged in MEDIUM, not auto-removed.)
- `packages/agent/src/api/index.ts` — barrel `export * from "./server"`, no consumer ever imports `agent/src/api`. The single concrete file (`server.ts`) is imported directly elsewhere.
- `packages/agent/src/platforms/index.ts` — barrel `export * from "./telegram"`, no consumer. Same pattern as `api/index.ts`.
- `packages/agent/src/services/index.ts` — barrel re-exporting 9 services. `grep -rE "from ['\"][^'\"]*\/services['\"]"` returned no matches. Direct imports of each service file are used everywhere.

### Exports
None removed. The 55 unused-exports findings are dominated by:
- Barrel re-exports (`Cards/index.ts`, `Vault/index.ts`, `lib/hypercerts/index.ts`) kept for API surface stability.
- shadcn-style `*Variants` constants (`buttonVariants`, `cardVariants`, `statusBadgeVariants`, `badgeVariants`, `avatarVariants`) — by convention these are public API even when no in-tree caller exists.
- Test utilities re-exported from `__tests__/test-utils.tsx` for incremental adoption.
- Constants intentionally kept for upcoming work (e.g. `MAX_IMAGE_SIZE_BYTES`, `MAX_IMAGE_COUNT`, `ALLOWED_IMAGE_TYPES`).

Touching any of these one-by-one would create a long ripple of follow-up edits and test churn that does not match the cost/benefit of a "clean" pass.

### Types
None removed. All 78 unused-type findings are zero-runtime-cost. Most are exported alongside their parent component for downstream typing (`ButtonProps`, `CardProps`, `BadgeProps`, etc.). Removing them produces churn without bytes-saved or runtime-clarified.

### Dependencies
None removed. Notes on each candidate below in MEDIUM.

## MEDIUM (NOT removed)

These were considered but blocked on verification ambiguity, contract-domain risk, or downstream-impact uncertainty. Worth a focused pass with the right skill (contracts, ops) before touching.

### `.skip.ts` parked tests (intentional, expiry passed)
- `packages/shared/src/__tests__/utils/ens.test.skip.ts` — header annotation: `// SKIP: #312 — createPublicClientForChain mock doesn't intercept real Pimlico config import. Owner: shared / Expiry: 2026-03-17`. Expiry passed. Belongs to whoever owns issue #312 to either reactivate or formally retire — not a knip-driven cleanup.
- `packages/shared/src/__tests__/utils/text.test.skip.ts` — same `.skip.ts` pattern; same handling.

### Shared hook with stale references
- `packages/shared/src/hooks/work/useWorkMetadata.ts` — `grep -rn useWorkMetadata` returned only self-references. Shared hooks are flagged **critical** in CLAUDE.md. Removing requires a focused review by the work-domain owner; not safe for an automated sweep.

### Indexer "test stub" that is actually a real test
- `packages/indexer/test/test.ts` — knip flags it as unused, but `packages/indexer/package.json` runs mocha against `"test/**/*.ts"`, and the file contains real `describe`/`it` blocks for ActionRegistry, GardenToken, and Octant retained surfaces. **Knip false positive — DO NOT REMOVE.**

### i18n completeness checker
- `.claude/scripts/check-i18n-completeness.mjs` — referenced from `.claude/skills/audit/SKILL.md` (line 135). Knip blind to skill markdown invocations. **DO NOT REMOVE.**

### GDrive MCP server
- `channels/gdrive/server.ts` — initially staged for removal, then reverted. Per project memory (`reference_gdrive_mcp.md`): "GDrive MCP server at channels/gdrive/ — NOT registered in .mcp.json". The file IS the entire `gdrive-mcp` package's bin/start entry point — removing only the script while leaving `package.json` would yield a broken package. The whole `channels/gdrive/` package is dormant; it's a deliberate parked workspace. Belongs to the channels-strategy decision, not this cleanup.

### Service worker
- `packages/client/public/sw-custom.js` — referenced from `packages/client/vite.config.ts:129` (`importScripts: ["sw-custom.js"]`). **Knip false positive — DO NOT REMOVE.**

### Docusaurus custom CSS
- `docs/src/css/custom.css` — referenced from `docs/docusaurus.config.ts:52` (`customCss: './src/css/custom.css'`). **Knip false positive — DO NOT REMOVE.**

### Solidity-side dependencies
The contract package's "unused" dependency list is entirely Solidity-side imports (knip can't parse `.sol` files):
- `@chainlink/contracts-ccip` — used in `packages/contracts/src/mocks/CCIPRouter.sol`, `registries/ENS.sol`, `registries/ENSReceiver.sol`.
- `@ensdomains/ens-contracts` — used via `@ens` remapping in `interfaces/IENS.sol`.
- `@ethereum-attestation-service/eas-contracts` — used via `@eas` remapping in resolvers, modules, mocks.
- `@openzeppelin/contracts-upgradeable` — used via `@openzeppelin/contracts-upgradeable` remapping in registries, resolvers, markets.
- `@openzeppelin/contracts-5.0.2` — used via `@openzeppelin/contracts@5.0.2/` remapping in `strategies/AaveV3ERC4626.sol`.
- `@openzeppelin/contracts-4.8.3` — remapped but no current `src/` usage found in this snapshot. Left to **contracts skill** review (could be vendor/lib transitive, or a planned migration anchor).

**DO NOT REMOVE any of these without contracts-domain review.**

### Workspace-level devDependencies that look unused but aren't
Knip flagged the following at root; each is consumed in a way knip can't see:
- `@tailwindcss/forms`, `@tailwindcss/typography`, `@tailwindcss/postcss`, `tailwindcss-animate` — postcss/Tailwind plugin chain, loaded by config not import.
- `babel-plugin-react-compiler` — referenced as a string literal in `packages/admin/vite.config.ts:37` and `packages/client/vite.config.ts:99`.
- `lighthouse` — invoked via `lhci` in `lighthouse:client`/`lighthouse:admin` scripts.
- `lint-staged` — invoked via husky `lint-staged` config in `package.json`.
- `oxlint` — invoked from the root `lint` script.
- `sharp` — invoked via `scripts/upload-action-images.ts` and `scripts/repin-ipfs-media.ts`.
- `tsc-alias` — referenced from `packages/contracts` build chain (path alias rewriting).
- `vite-plugin-mkcert` — used in `packages/client/vite.config.ts` (HTTPS local dev).
- `wait-port` — used in `ecosystem.config.cjs` and `scripts/dev-doctor.ts` health checks.
- `qrcode` / `@types/qrcode` — used in scripts (passkey QR display); confirm before any future removal.
- `graphql` — peer dependency for codegen / Envio tooling.
- `@varlock/1password-plugin` — used by varlock CLI runtime resolution.
- `@reown/appkit` (admin and client) — referenced from test mocks (`vi.mock("@reown/appkit", ...)` in `__tests__/setup.ts` of both packages). Mock factories are knip-blind.

### Agent devDeps that may be removable but require owner sign-off
- `@faker-js/faker` (agent) — only consumed by the (now removed) `factories.ts`. Genuinely unused in agent **after this commit**, but I left the dep in place so the agent owner can decide whether the package's removal is the desired follow-up (or whether someone planned to wire it back up). Marking as a low-effort follow-up.
- `tsx` (agent) — no current invocation found; root `tsx` is in workspace deps for everyone. Could go but the cost/benefit is tiny and I'd rather not touch the agent package metadata in a sweep.
- `pino-pretty` (agent) — used at runtime via `pino`'s `transport.target: "pino-pretty"` string config in `packages/agent/src/services/logger.ts:19`. **DO NOT REMOVE — knip false positive.**
- `uint8arrays` (root) — heavily wired through `scripts/fix-multiformats.js`, vitest config dedupe lists in shared/admin/client, and a deliberate root `overrides`/`resolutions` block. **DO NOT REMOVE — keep.**

## LOW (NOT removed)

Skipped entirely by design (per advisor guidance):
- All 55 **unused exports** — barrel re-exports, shadcn variants, intentional API surface, parked test utilities. Cherry-picking risks API churn for zero runtime gain.
- All 78 **unused exported types** — zero runtime cost; exported alongside components for downstream typing.
- The 1 **unused enum member** finding (`Exponential`, `Power` on `WeightScheme`) — preserves enum-domain completeness; removing without contract-domain review risks breaking on-chain contract surface alignment.
- All **unlisted Storybook dependencies** — `@storybook/react` and `storybook` are workspace-scoped peer deps satisfied at the workspace root or via Storybook's own resolution. Not a real issue.
- All **unlisted binaries** (`lsof`, `anvil`, `forge`, `cast`, `pkill`, `printf`, `trap`, `start`) — shell builtins or Foundry CLI installed at the system level. Not knip-actionable.

## Knip false-positives discovered (for future ignore tuning)

If/when knip's config is tuned in this repo, add ignore rules for:
- `packages/indexer/test/**/*.ts` — mocha test glob, not import-resolvable.
- `packages/client/public/sw-custom.js` — service worker fragment, loaded via `importScripts` from generated SW.
- `docs/src/css/custom.css` — referenced from Docusaurus config.
- `babel-plugin-react-compiler` (admin and client) — string-literal vite plugin.
- `pino-pretty` (agent) — string-literal pino transport target.
- `@reown/appkit` test mocks (admin and client setup files).
- All `*.stories.tsx` "Unlisted dependencies" — Storybook is hoisted to root; treat as expected.
- `lighthouse`, `lint-staged`, `oxlint`, `sharp`, `tsc-alias`, `vite-plugin-mkcert`, `wait-port`, `tailwindcss-*`, `@varlock/1password-plugin`, `qrcode`/`@types/qrcode`, `graphql`, `uint8arrays` — workspace-tooling dependencies invoked by config or scripts.
- All Solidity-only contract deps (`@chainlink/contracts-ccip`, `@ensdomains/ens-contracts`, `@ethereum-attestation-service/eas-contracts`, `@openzeppelin/contracts-*`).
- `.claude/scripts/check-i18n-completeness.mjs` — invoked from `.claude/skills/audit/SKILL.md`.

## Files removed (final list)

```
packages/admin/src/components/Vault/funderTotals.ts
packages/admin/src/styles/main-rail-layout.css
packages/admin/src/views/Endowments/GardenVaultCard.tsx
packages/admin/src/views/Endowments/ImpactFundersDialog.tsx
packages/admin/src/views/Endowments/ImpactFundersSidebar.tsx
packages/admin/src/views/Endowments/MyPositionsSidebar.tsx
packages/agent/src/__tests__/utils/factories.ts
packages/agent/src/api/index.ts
packages/agent/src/platforms/index.ts
packages/agent/src/services/index.ts
```

## Verification evidence

- `bunx tsc --noEmit` (admin): clean.
- `bun run typecheck` (agent): clean.
- `vitest run` (agent): 5 files / 55 tests pass.
- `vitest run` (admin): 23 files / 250 tests pass + 3 pre-existing failures (`GardenYieldCard.test.tsx` 1, `DepositModal.test.tsx` 2). Confirmed pre-existing via `git stash` baseline run.
- `vitest run` (shared): 189 files / 2770 tests pass + 13 pre-existing failures in vault/yield/roles hooks. Confirmed pre-existing via `git stash` baseline run on `useGardenYieldSummary.test.ts` (same 10 failures with my changes stashed).
- Net regressions introduced by this commit: **0**.
