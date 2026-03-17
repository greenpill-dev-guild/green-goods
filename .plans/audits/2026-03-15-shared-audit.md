# Audit Report - 2026-03-15 (shared)

## Executive Summary

- **Packages analyzed**: shared
- **Critical**: 0 | **High**: 1 | **Medium**: 8 | **Low**: 5
- **Dead code**: 2 unused files, 23 unused exports, 29 unused exported types, 1 unused enum member
- **Lint warnings**: 6 (2 a11y, 1 exhaustive-deps, 1 unused-var, 1 rules-of-hooks, 1 unused-import)
- **Architectural violations**: 0 hooks outside shared, 0 skill drift, 0 package .env files
- **Tests**: 187 files, 2739 passed, 1 skipped
- **Mode**: Single-agent
- **Baseline**: c008b2b9 (no committed shared changes since 2026-03-09 audit; 2 unstaged changes)

### Unstaged Changes (not yet committed)
- `Toast/presets/update.ts`: duration changed from 60000ms to `Infinity`
- `modules/app/error-tracking.ts`: browser extension errors now filtered from unhandled rejection handler

---

## Previous Findings Status

_Tracked from: 2026-03-09_

### High Findings

| ID | Finding | File | Status | Cycles Open | Notes |
|----|---------|------|--------|-------------|-------|
| H1 | Hardcoded Hypercert Minter addresses | `shared/hooks/hypercerts/hypercert-contracts.ts:44-52` | STILL OPEN | 5 (since 2026-02-18) | 4 chain addresses as fallback map. Now **chronic** per escalation policy |

### Medium Findings (shared-scoped)

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| M1 | setInterval singleton leak in job queue | STILL OPEN | `startCleanupScheduler()` guards against double-start but no AbortSignal |
| M5 | `as any` in production code | STILL OPEN | 24 total (unchanged) |
| M7 | TODO comments in production code | STILL OPEN | Now 6 TODOs (was 3 shared-scoped; 3 new in transaction senders) |
| M8 | Unused exports (shared-scoped) | STILL OPEN | 23 exports + 29 types (down from ~28/18 — knip now more precise) |
| M9 | God object candidates in shared | STILL OPEN | Same files, same line counts |
| M11 | Bare catch blocks in shared | STILL OPEN | 80 (unchanged from 2026-03-09) |

---

## High Findings

### H1. Hardcoded Hypercert Minter addresses (STILL OPEN, **chronic** -- open 5+ cycles)

- **File**: `packages/shared/src/hooks/hypercerts/hypercert-contracts.ts:44-52`
- **Issue**: Chain-specific contract addresses hardcoded as a fallback map (`HYPERCERT_MINTER_BY_CHAIN`). Silent staleness risk if Hypercerts protocol redeploys minters. No automated health check or registry comparison exists.
- **Confidence**: HIGH
- **Recommendation**: Either (a) document an explicit update procedure and add a CI check comparing these addresses against the Hypercerts deployment registry, or (b) mark this as ACCEPTED if the fallback is intentionally conservative. This finding has been open since 2026-02-18 (5 consecutive audits) and requires a decision.

---

## Medium Findings

### M1. setInterval singleton leak in job queue (STILL OPEN, open 5+ cycles)

- **File**: `packages/shared/src/modules/job-queue/index.ts:872`
- **Issue**: `startCleanupScheduler()` guards against double-start (line 873: `if (this.cleanupIntervalId) return`), but there is no AbortSignal integration. If the module is hot-reloaded or re-instantiated during development, the old interval leaks.
- **Confidence**: HIGH
- **Recommendation**: Accept as DEFERRED (production singleton, HMR-only risk) or add AbortSignal/cleanup registration.

### M2. Rules-of-hooks violation: useMutation in factory function

- **File**: `packages/shared/src/hooks/gardener/useGardenerProfile.ts:212-263`
- **Issue**: `createFieldMutation` is a non-hook helper function that calls `useMutation()`. This violates React's rules of hooks -- hooks must be called at the top level of a component or custom hook, not inside a factory function. The linter correctly flags this. While it works in practice because the factory is always called unconditionally at the top level of the parent hook, it is fragile and would break if the factory were called conditionally.
- **Confidence**: HIGH
- **Recommendation**: Refactor to call `useMutation()` directly for each field, or rename the factory to `useFieldMutation` and ensure it follows hook rules.

### M3. Hardcoded vault asset addresses

- **File**: `packages/shared/src/utils/blockchain/vaults.ts:12-40`
- **Issue**: WETH and DAI addresses for Arbitrum, Sepolia, and Celo are hardcoded in `ASSET_SYMBOLS_BY_CHAIN` and `ASSET_DECIMALS_BY_CHAIN`. These are well-known canonical addresses unlikely to change, but the pattern mirrors H1's fallback approach. Additionally, the unused `Address` type import on line 2 generates a lint warning.
- **Confidence**: MEDIUM (lower risk than H1 since these are canonical ERC-20 addresses)
- **Recommendation**: Remove unused `Address` import. Consider whether these should be sourced from the deployment artifact.

### M4. Unused variable: `chainId` in useUpdateGarden

- **File**: `packages/shared/src/hooks/garden/useUpdateGarden.ts:41`
- **Issue**: `const chainId = useCurrentChain()` is declared but never used. Lint flags this.
- **Confidence**: HIGH
- **Recommendation**: Remove the unused variable or prefix with `_`.

### M5. `as any` assertions in production code (24 instances, unchanged)

Key offenders:
- `config/appkit.ts` (4 uses) -- Reown/WalletConnect SDK type gaps
- `modules/app/service-worker.ts` (4 uses) -- `import.meta` env access
- `modules/translation/diagnostics.ts` (4 uses) -- Chrome AI API detection
- `modules/translation/browser-translator.ts` (2 uses) -- Chrome AI API
- `modules/job-queue/index.ts` (3 uses) -- 2 structural `as any` + `import.meta`
- `modules/job-queue/event-bus.ts` (1 use) -- `import.meta`
- `hooks/vault/useVaultPreview.ts:39` -- `contracts as any` (wagmi type mismatch)
- `hooks/blockchain/useTransactionSender.ts:58` -- `writeContractAsync as any` (NEW since last audit)
- `hooks/ens/useENSRegistrationStatus.ts:76` -- `import.meta`
- `components/Toast/toast.service.tsx:602` -- icon cast
- `components/Toast/ToastViewport.tsx:60,62` -- iconTheme casts

**Confidence**: HIGH
**Recommendation**: Low-hanging fruit: `useVaultPreview` and `useTransactionSender` should be properly typed with wagmi generics. `import.meta` accesses can use `import.meta.env` with a Vite env.d.ts augmentation.

### M6. TODO comments in production code (6 in shared)

| File | Line | TODO |
|------|------|------|
| `modules/data/eas.ts` | 434 | Pagination not implemented |
| `hooks/gardener/useGardenerProfile.ts` | 129 | Using placeholder instead of GraphQL |
| `modules/transactions/wallet-sender.ts` | 68 | EIP-5792 sendCalls with paymasterService |
| `modules/transactions/passkey-sender.ts` | 57 | permissionless sendUserOperation batching |
| `modules/transactions/embedded-sender.ts` | 52 | EIP-5792 sendCalls with paymasterService |
| `modules/transactions/embedded-sender.ts` | 93 | EIP-5792 sendCalls for atomic batching |

**Confidence**: HIGH
**Recommendation**: The 3 EIP-5792 TODOs are new (from the `useTransactionSender` migration). Track as a future enhancement.

### M7. Exhaustive-deps warning in ConfidenceSelector

- **File**: `packages/shared/src/components/Form/ConfidenceSelector.tsx:88`
- **Issue**: `useCallback` has missing dependencies `CONFIDENCE_OPTIONS` and `CONFIDENCE_OPTIONS.length`. While these are module-level constants that will never change, the linter flags it. Suppressing with an eslint-disable comment would be cleaner.
- **Confidence**: MEDIUM (no runtime bug, but lint noise)
- **Recommendation**: Add `CONFIDENCE_OPTIONS` to the dependency array (safe since it is a constant) or add an eslint-disable comment.

### M8. WorkCard a11y: click handler without keyboard listener

- **File**: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:257,274`
- **Issue**: Two elements (image preview overlay `div` and `img`) have `onClick` handlers but no `onKeyDown`/`onKeyUp` listener. The overlay `div` does have `role="dialog"` and `aria-modal="true"`, which partially mitigates, but the `img` at line 274 with `onClick` lacks keyboard handling.
- **Confidence**: MEDIUM
- **Recommendation**: Add `onKeyDown` handler for Escape key on the dialog div (it already has a close button), and consider whether the img click-to-close needs keyboard support.

---

## Low Findings

### L1. XState type safety bypass (carried)
- `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:457` -- `as unknown as typeof` at XState `provide()` boundary. Known limitation.

### L2. Raw setTimeout in Auth provider (carried)
- `packages/shared/src/providers/Auth.tsx:160` -- ref-managed `setTimeout` for wallet hydration. Properly cleans up.

### L3. Bare catch blocks (80 in production)
- 80 bare `catch {` blocks in shared/src (excluding tests). Most have fallback logic but discard error context. No change from previous audit.

### L4. Unused enum members
- `packages/shared/src/types/contracts.ts`: `Exponential`, `Power` in `WeightScheme` -- no usage found.

### L5. Skipped test files flagged as unused
- `packages/shared/src/__tests__/utils/ens.test.skip.ts`
- `packages/shared/src/__tests__/utils/text.test.skip.ts`

---

## Dead Code Summary (shared only)

**Source**: knip `--workspace @green-goods/shared`

| Category | Count |
|----------|-------|
| Unused files | 2 (both skipped test files) |
| Unused exports | 23 |
| Unused exported types | 29 |
| Unused enum members | 1 (WeightScheme: Exponential, Power) |

### Top unused export clusters:

1. **Hypercert library** (`lib/hypercerts/index.ts`): 16 re-exported symbols (schemas, proof functions, ABIs) -- likely exposed for future consumer use
2. **PostHog** (`modules/app/posthog.ts`): 6 unused utility functions (`getAppVersion`, `getChainId`, environment helpers)
3. **Auth internals** (`providers/Auth.tsx`, `modules/auth/session.ts`): 4 symbols (`useOptionalAuthContext`, `AUTH_MODE_STORAGE_KEY`, `CREDENTIAL_STORAGE_KEY`, `debugPasskeyConfig`)
4. **Toast** (`components/Toast/ToastViewport.tsx`): `defaultToastOptions`
5. **Storage utils** (`utils/storage/avatar-cache.ts`): `clearAvatarCache`, `removeCachedAvatar`

---

## Skill & Configuration Drift

All hooks, utilities, and types referenced in skills verified as present:

| Reference | Location | Status |
|-----------|----------|--------|
| All 12 hooks | Skills | OK |
| All 9 utilities | Skills | OK |
| All 10 types | Skills | OK |
| Port assignments | ecosystem.config.cjs | OK |
| Core commands | root package.json | OK |
| Environment vars | .env.schema | OK |

**Note**: Shared package `lint` script (`oxlint src`) fails when run via `bun run --filter` due to Node.js 18 ESM extension resolution issue with the oxlint binary. The workspace `bun lint` command works because it runs oxlint directly from the root. This is a tooling issue, not a code issue.

---

## Architectural Anti-Patterns (shared only)

| Anti-Pattern | Location | Lines | Cycles Open | Severity |
|--------------|----------|-------|-------------|----------|
| God object | `shared/modules/data/hypercerts.ts` | 938 | 5+ | MEDIUM |
| God object | `shared/modules/job-queue/index.ts` | 916 | 5+ | MEDIUM |
| God object | `shared/modules/data/ipfs.ts` | 819 | 5+ | MEDIUM |
| God object | `shared/hooks/vault/useVaultOperations.ts` | 798 | 3+ | MEDIUM |
| God object | `shared/modules/app/error-tracking.ts` | 753 | 3+ | MEDIUM |
| God object | `shared/workflows/authMachine.ts` | 722 | 3+ | MEDIUM |
| God object | `shared/hooks/query-keys.ts` | 712 | 3+ | MEDIUM |
| God object | `shared/components/Toast/toast.service.tsx` | 664 | 3+ | MEDIUM |
| God object | `shared/hooks/hypercerts/useMintHypercert.ts` | 641 | 3+ | MEDIUM |
| God object | `shared/hooks/work/useWorkMutation.ts` | 623 | NEW | MEDIUM |
| God object | `shared/providers/Auth.tsx` | 620 | NEW | MEDIUM |
| Rules-of-hooks | `shared/hooks/gardener/useGardenerProfile.ts:212` | -- | NEW | MEDIUM |
| No hooks outside shared | -- | -- | -- | OK |
| No package-level .env | -- | -- | -- | OK |
| No console.log in production | -- | -- | -- | OK |

---

## Trend (shared-scoped, last 2 audits)

| Metric | 2026-03-09 | 2026-03-15 (current) |
|--------|------------|----------------------|
| Critical | 0 | **0** |
| High | 1 (H1) | **1** (H1 chronic) |
| Medium | ~8 | **8** |
| Low | ~5 | **5** |
| Unused files (shared) | 2 | **2** |
| Unused exports (shared) | ~28 | **23** |
| Unused types (shared) | ~18 | **29** (knip more precise) |
| `as any` (prod) | 24 | **24** |
| Bare catch (prod) | 80 | **80** |
| Lint warnings | N/A | **6** |
| TODOs | 3 | **6** |
| God objects (500+) | 9 | **11** |
| Tests passing | N/A | **2739** |
| Findings fixed | 3 | **0** |
| Findings opened | 0 | **3** (M2, M4, M8) |
| Resolution velocity | >1.0 | **0.0** |

**Observations**:
- No committed changes to shared since last audit. The 2 unstaged changes (toast duration and extension error filter) are reasonable improvements.
- The `useTransactionSender` migration (commit 28b3231d) introduced a new `as any` (`writeContractAsync`) and 3 new TODO comments for EIP-5792.
- H1 (hardcoded Hypercert addresses) is now chronic at 5 cycles. Needs an explicit accept/defer decision.
- God object count grew from 9 to 11 with `useWorkMutation.ts` (623 lines) and `Auth.tsx` (620 lines) crossing the threshold. These were likely at this size before but not individually tracked for shared.
- The rules-of-hooks violation in `useGardenerProfile.ts` (M2) is new and should be addressed promptly as it could cause subtle bugs if the factory is ever called conditionally.
- Knip reports 29 unused types (up from ~18) -- this is likely a precision improvement in knip's analysis rather than actual regression.
- Test suite is healthy: 187 files, 2739 tests passing.

---

## Recommendations (Priority Order)

1. **Decide on H1 (Hypercert Minter addresses)** -- mark ACCEPTED or add a CI health check. 5 cycles chronic. (High, H1)
2. **Fix rules-of-hooks violation** -- refactor `createFieldMutation` in `useGardenerProfile.ts` to call `useMutation` directly or rename to `useFieldMutation`. (Medium, M2)
3. **Remove unused `chainId` variable** in `useUpdateGarden.ts:41`. (Medium, M4)
4. **Fix lint warnings** -- a11y keyboard handlers on WorkCard, exhaustive-deps in ConfidenceSelector, unused Address import in vaults.ts. (Medium, M7/M8/M3)
5. **Type the `as any` in `useTransactionSender` and `useVaultPreview`** -- low-hanging fruit with wagmi generics. (Medium, M5)
6. **Clean up 23 unused exports** as identified by knip, starting with PostHog utilities and auth internals. (Low-Medium, M8 from prior audit)
7. **Decide on job queue interval leak** -- accept as DEFERRED or add AbortSignal. (Medium, M1)
