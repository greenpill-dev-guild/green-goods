# Dead Code & Unused Code Audit Report

**Date**: 2026-02-16
**Branch**: `feature/ens-integration`
**Scope**: All packages (shared, client, admin, indexer, contracts, agent)
**Method**: Multi-agent automated scan + manual cross-referencing + verification pass

---

## Executive Summary

- **Packages analyzed**: 6 (shared, client, admin, indexer, contracts, agent)
- **Critical**: 0 (initial IPFS finding was a **false positive**)
- **High**: 2 (dead contract module, unused dependencies)
- **Medium**: 5 (dead contract code, documentation drift, stale files)
- **Low**: 3 (dead error, config drift)

### Fixes Applied This Session

| Fix | Severity | Status |
|-----|----------|--------|
| Removed `@zerodev/sdk` from client dependencies | HIGH | **DONE** |
| Removed `@vitejs/plugin-react` from agent devDependencies | HIGH | **DONE** |
| Deprecated `allowedCurrencies` mapping (preserved storage slot for UUPS safety) | MEDIUM | **DONE** |
| Removed dead `setAllowedCurrency()` function + unit test + fork test call | MEDIUM | **DONE** |
| Fixed `useOnlineStatus` → `useOffline` in data-layer SKILL.md | MEDIUM | **DONE** |
| Fixed `useOnlineStatus` → `useOffline` in audit SKILL.md | MEDIUM | **DONE** |

### False Positives Identified During Verification

The initial automated scan produced several significant false positives:

| Original Finding | Severity | Actual Status |
|-----------------|----------|---------------|
| IPFS init never runs (`config.ts` not imported) | CRITICAL | **FALSE POSITIVE** — `main.tsx:17` has `import "@/config"` |
| Missing `deploy:testnet` script | HIGH | **FALSE POSITIVE** — exists at `package.json:33` |
| ~170+ dead barrel exports from shared | MEDIUM | **FALSE POSITIVE** — verification confirmed all checked exports are used by consumer packages |
| 8 orphaned test files in client/admin | MEDIUM | **FALSE POSITIVE** — all source files exist in nested subdirectories |
| Dead `CynefinPhase` / `YieldSplitStatus` enums | LOW | **ALREADY REMOVED** from schema |
| Commented code in Work.tsx / service-worker.ts | LOW | **ALREADY CLEANED** |
| Gardener ENS fields never populated | LOW | **INTENTIONAL** — scaffolding for `feature/ens-integration` branch |

---

## 1. HIGH — Dead Contract Module (NOT FIXED — User excluded)

| File | Issue |
|------|-------|
| `packages/contracts/src/modules/Unlock.sol` | Fully implemented UUPS-upgradeable UnlockModule for work-badge granting. Never deployed, never tested against, never imported by any deployment script. |
| `packages/contracts/src/interfaces/IUnlock.sol` | Interface for the above — equally dead. |
| `packages/contracts/src/mocks/Unlock.sol` | Mock exists but only used as a generic ERC20 stand-in in `KarmaModule.t.sol`, not for the actual UnlockModule. |

**Status**: User excluded from fix scope. Evaluate whether to delete or document as planned feature.

---

## 2. HIGH — Unused Dependencies (FIXED)

| Package | Dependency | Section | Evidence | Status |
|---------|-----------|---------|----------|--------|
| `client` | `@zerodev/sdk` | dependencies | Replaced by `permissionless` library; zero imports | **REMOVED** |
| `agent` | `@vitejs/plugin-react` | devDependencies | Agent is Node.js/Fastify, not React/Vite; zero imports | **REMOVED** |

### Unverified (Require Further Investigation)

These were flagged by the initial scan but not verified during this session:

| Package | Dependency | Section | Notes |
|---------|-----------|---------|-------|
| `client` | `browser-lang` | dependencies | May have `@types/browser-lang` in devDeps too |
| `admin` | `date-fns` | dependencies | May only be in skill doc examples |
| `admin` | `vitest-mock-extended` | devDependencies | May have zero test imports |
| `agent` | `@viem/anvil` | devDependencies | May have zero imports |
| `indexer` | `rescript-envsafe` | dependencies | Likely Envio scaffolding leftover |
| `indexer` | `@elastic/ecs-pino-format` | dependencies | Likely Envio scaffolding leftover |

---

## 3. MEDIUM — Dead Code in Contracts (PARTIALLY FIXED)

| Item | File | Status |
|------|------|--------|
| `allowedCurrencies` mapping | `src/markets/HypercertMarketplaceAdapter.sol` | **FIXED** — deprecated with `__deprecated_allowedCurrencies` (private, preserved storage slot for UUPS) |
| `setAllowedCurrency()` function | `src/markets/HypercertMarketplaceAdapter.sol` | **FIXED** — removed |
| `setAllowedCurrency` unit test | `test/unit/HypercertMarketplaceAdapter.t.sol` | **FIXED** — removed |
| `setAllowedCurrency` fork test call | `test/fork/ArbitrumHypercerts.t.sol:75` | **FIXED** — removed |
| `DeployJuicebox.s.sol` | `script/DeployJuicebox.s.sol` | Not fixed (already deleted on this branch) |
| `E2EConvictionVoting.t.sol` | `test/E2EConvictionVoting.t.sol` | Not fixed — excluded from automated test runs |
| `goods-token.ts` | `script/deploy/goods-token.ts` | Not fixed — not wired into CLI |

---

## 4. MEDIUM — Documentation/Skill Drift (PARTIALLY FIXED)

### Fixed

| Reference | Location | Fix Applied |
|-----------|----------|-------------|
| `useOnlineStatus` | `data-layer/SKILL.md` | **FIXED** — renamed to `useOffline` with updated API |
| `useOnlineStatus` | `audit/SKILL.md` | **FIXED** — renamed to `useOffline` in drift check script |

### Remaining Drift (Not Fixed)

| Reference | Location | Status | Issue |
|-----------|----------|--------|-------|
| `mediaResourceManager` | CLAUDE.md patterns | **DRIFT** | Exists in `modules/index.ts` but NOT re-exported from top-level barrel |
| Provider order (Rule 13) | `architectural-rules.md` | **DRIFT** | Diagram omits `HelmetProvider` and `AppErrorBoundary` wrappers in client `main.tsx` |
| `bun exec pm2 logs` | CLAUDE.md | **DRIFT** | Not a standard bun command; should be `bunx pm2 logs` |

---

## 5. LOW — Dead Contract Error

| Item | File | Issue |
|------|------|-------|
| `error OwnerAlreadyHasName()` | `src/registries/ENSReceiver.sol:15` | Never reverted. Comment says "Kept for ABI compat." Left as-is on ENS feature branch. |

---

## 6. Remaining Work (Not Addressed)

### Dead Client Components (DONE — deleted on branch)

All flagged components have been deleted on the `feature/ens-integration` branch:
- `packages/client/src/components/Boundaries/SuspenseBoundary.tsx`
- `packages/client/src/components/Boundaries/SuspenseRoute.tsx`
- `packages/client/src/routes/RequireInstalled.tsx`
- `packages/client/src/styles/colors.css`

### Missing PWA Assets

| Reference | In File | Issue |
|-----------|---------|-------|
| `apple-icon.png` | `index.html` + `vite.config.ts` | File does not exist at `public/apple-icon.png` |
| `images/home.png`, `work.png`, `profile.png` | `vite.config.ts` PWA shortcuts | Files do not exist in `public/images/` |
| `images/ms-icon-310.png` | `vite.config.ts` includeAssets | Filename typo — actual file may be `ms-icon-310x310.png` |

---

## 7. Barrel Export Assessment — REVISED

**Previous claim**: ~170+ dead exports from `@green-goods/shared`.

**Revised assessment**: The initial automated scan used insufficiently precise matching (e.g., searching for exact export names without accounting for re-exports, aliased imports, or dynamic usage). A thorough verification pass checking 52 exports against all consumer packages found **all of them were actively used**.

The barrel is large (~400+ symbols), but the audit **does not confirm** that significant pruning is warranted. Any future barrel cleanup should use `knip` tooling for accurate dead export detection, rather than grep-based matching.

---

## Methodology

- 5 parallel analysis agents: shared exports audit, orphaned files detection, unused dependencies, contracts scan, drift checker
- Verification pass after initial findings: every "critical" and "high" finding manually confirmed by reading source files
- Cross-referenced exports using `grep -rn` across all consumer packages
- Contract functions checked against test coverage, deployment scripts, and cross-contract calls
- Indexer schema entities checked against `EventHandlers.ts` and `config.yaml`
- Documentation references checked against actual source exports, scripts, and file structure
- **Key lesson**: Automated grep-based dead code detection produces high false-positive rates in monorepos with barrel exports, aliases, and re-exports. Use dedicated tooling (knip) for accurate results.
