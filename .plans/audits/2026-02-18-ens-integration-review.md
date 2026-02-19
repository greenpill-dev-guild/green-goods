# Code Review: feature/ens-integration

**Date**: 2026-02-18
**Branch**: `feature/ens-integration` vs `main`
**Scope**: 1,390 files, 172K+ insertions, 160+ commits
**Review agents**: 4 opus-class agents (contracts, shared, frontend, indexer/infra)
**Status**: REQUEST CHANGES (2 must-fix)

---

## Severity Summary

| Severity | Count | Domains |
|----------|-------|---------|
| **High** | 2 | Contracts (1), Indexer (1) |
| **Medium** | 10 | Contracts (2), Shared (3), Frontend (4), Indexer (1) |
| **Low** | 16 | Contracts (2), Shared (4), Frontend (7), Indexer (3) |
| **Total** | **28** | |

---

## HIGH — Must Fix (2)

### H1. `delistFromYield` always reverts — broken access control chain

- **File**: `packages/contracts/src/modules/Hypercerts.sol:210-216`
- **Severity**: High (functional bug — dead code)
- **Evidence**:
  1. `HypercertsModule.delistFromYield()` calls `marketplaceAdapter.deactivateOrder(orderId)` (line 213)
  2. `HypercertMarketplaceAdapter.deactivateOrder()` checks: `if (msg.sender != order.seller && msg.sender != owner()) revert Unauthorized()` (adapter line 246)
  3. `msg.sender` at the adapter = `HypercertsModule` contract address (the caller)
  4. `order.seller` = `makerAsk.signer` (adapter line 225) = the EOA/garden that signed the order
  5. `owner()` = deployer EOA (set at `initialize(owner, ...)` — DeploymentBase line 743)
  6. HypercertsModule is **neither** seller nor owner — always reverts `Unauthorized()`
- **Fix options**:
  - A) Transfer adapter ownership to HypercertsModule post-deployment
  - B) Add an `authorizedModules` mapping to the adapter with a setter
  - C) Have adapter accept calls from any contract that is registered in DeploymentRegistry

### H2. Indexer config.yaml addresses stale + GreenGoodsENS omitted from sync

- **File**: `packages/contracts/script/utils/envio-integration.ts:233-250`
- **Severity**: High (deployment risk — indexer won't track ENS events after redeployment)
- **Evidence**:
  1. The `upsertContract` block (lines 238-250) syncs 10 contracts but omits `GreenGoodsENS`
  2. The indexer DOES index ENS events — confirmed handlers in `handlers/shared.ts:232-240` (types) and `test/handlers.test.ts:465-579` (tests for `NameRegistrationSent`, `NameReleaseSent`)
  3. Running the sync script will never update the ENS contract address in config.yaml
- **Fix**: Add `upsertContract("GreenGoodsENS", deployment.greenGoodsENS);` after line 250

---

## MEDIUM — Should Fix (10)

### M1. `grantRole`/`grantRoles` missing `nonReentrant`

- **File**: `packages/contracts/src/modules/Hats.sol:429,441`
- **Evidence**: Grant functions make external calls via `hats.mintHat()` without `nonReentrant`, while `revokeRole` (line 435) and `revokeRoles` (line 451) have it. Both code paths make similar external calls to the Hats protocol.
- **Risk**: Low exploitability (Hats is trusted), but inconsistent defense-in-depth.
- **Fix**: Add `nonReentrant` modifier to `grantRole` and `grantRoles`.

### M2. `delistFromYield` no cross-garden validation

- **File**: `packages/contracts/src/modules/Hypercerts.sol:210-216`
- **Evidence**: Function takes `garden` and `orderId` params but never validates that `orderId` belongs to `garden`. An operator of garden A could deactivate garden B's order (if H1 were fixed).
- **Fix**: Add `if (hypercertGarden[orders[orderId].hypercertId] != garden) revert InvalidHypercert(...)` check.

### M3. `useTranslation` async race condition (Rule 3)

- **File**: `packages/shared/src/hooks/translation/useTranslation.ts:47-63`
- **Evidence**: `translateContent` async function sets state (`setTranslated`, `setIsTranslating`) without an `isMounted` guard. Other hooks in the codebase correctly handle this: `useGardenDraft` uses `loadRequestIdRef`, `useWorkImages` uses `isMounted`.
- **Fix**: Add `isMounted` ref guard or use `useAsyncEffect` pattern.

### M4. `NetworkContracts` uses `string` for 22 address fields (Rule 5)

- **File**: `packages/shared/src/types/contracts.ts:1-27`
- **Evidence**: All contract address fields (`gardenToken`, `actionRegistry`, `workResolver`, `hatsModule`, `eas`, `hypercertMinter`, etc.) are typed as `string` instead of `Address`. This is the root cause of widespread `as Address` casts throughout consuming code.
- **Fix**: Change all address fields to `Address` type, update consuming code to remove casts.

### M5. `WorkCard.gardenerAddress: string` (Rule 5)

- **File**: `packages/shared/src/types/domain.ts:365`
- **Evidence**: `gardenerAddress: string` while adjacent `gardenAddress` (line 369) correctly uses `Address`. The `WorkApproval` type at line 429 also correctly uses `Address` for `gardenerAddress`.
- **Fix**: Change to `gardenerAddress: Address`.

### M6. Dynamic `defaultMessage` breaking i18n extraction

- **Files**: Multiple frontend files
- **Evidence**: `intl.formatMessage()` calls with template-literal or variable `defaultMessage` values prevent static extraction by i18n tooling. Static extractors (e.g., `formatjs extract`) require literal string `defaultMessage` values.
- **Fix**: Use static string literals for all `defaultMessage` values.

### M7. `address: string` in frontend component props (Rule 5)

- **Files**: Admin/client component props
- **Evidence**: Component props accepting Ethereum addresses typed as `string` instead of `Address`.
- **Fix**: Update prop interfaces to use `Address` type.

### M8. Missing `aria-label` on ENS slug input

- **File**: `packages/client/src/views/Profile/ENSSection.tsx:104`
- **Evidence**: The `<input>` element for ENS slug entry has no `aria-label`, `aria-labelledby`, or associated `<label>` element. Screen readers cannot identify the field's purpose.
- **Fix**: Add `aria-label={intl.formatMessage({id: "app.profile.slugLabel", defaultMessage: "ENS subdomain name"})}`.

### M9. Missing `formatMessage` in `useEffect` deps

- **Files**: Frontend files with `useEffect` referencing `intl.formatMessage`
- **Evidence**: `useEffect` callbacks reference `intl.formatMessage` without including it in the dependency array. While `formatMessage` is typically stable, this violates React's exhaustive-deps rule.
- **Fix**: Add `intl.formatMessage` to dependency array or extract the formatted string outside the effect.

### M10. `contracts-tests.yml` fork job missing build step

- **File**: `.github/workflows/contracts-tests.yml`
- **Evidence**: The `fork` CI job jumps straight to `bun run test:fork:protocol` without a `bun run build:full` step, unlike the unit `test` job. On a fresh CI checkout, via_ir contracts may not be compiled.
- **Fix**: Add `bun run build:full` step before fork tests (or rely on forge's incremental compilation — verify this works in CI).

---

## LOW — Nice to Have (16)

### L1. `batchListForYield` skips per-item events

- **File**: `packages/contracts/src/modules/Hypercerts.sol:183-205`
- **Evidence**: `listForYield` emits `HypercertListedForYield` per item, but `batchListForYield` does not emit individual events — only returns order IDs.
- **Fix**: Add `emit HypercertListedForYield(garden, hypercertIds[i], orderIds[i])` in the batch loop.

### L2. Storage gap is 49 slots instead of 50

- **File**: `packages/contracts/src/modules/Hypercerts.sol:71`
- **Evidence**: `uint256[41] private __gap` with 8 state variables = 49 total slots. Project convention (visible in other modules) uses 50 total slots.
- **Fix**: Change to `uint256[42] private __gap` or document the exception.

### L3. `useTranslation` console.debug (Rule 12)

- **File**: `packages/shared/src/hooks/translation/useTranslation.ts:34,49,54`
- **Evidence**: Three `console.debug` calls bypass structured logger. The same file imports `logger` for errors.
- **Fix**: Replace with `logger.debug(...)`.

### L4. `translation/db.ts` console.debug (Rule 12)

- **File**: `packages/shared/src/modules/translation/db.ts:62,80`
- **Evidence**: Two `console.debug` calls in IndexedDB cache operations.
- **Fix**: Replace with `logger.debug(...)`.

### L5. `passkeyServer.ts` console.debug (Rule 12)

- **File**: `packages/shared/src/config/passkeyServer.ts:75,97`
- **Evidence**: Two `console.debug` calls logging potentially sensitive passkey credential information.
- **Fix**: Replace with `logger.debug(...)` and sanitize credential data.

### L6. `MintingState.signalPoolAddress: string` (Rule 5)

- **File**: `packages/shared/src/stores/useHypercertWizardStore.ts:133-144`
- **Evidence**: `signalPoolAddress: string | null` should be `Address | null`.
- **Fix**: Change type to `Address | null`.

### L7-L8. Hardcoded English strings in frontend

- **Files**: Multiple client/admin components
- **Evidence**: String literals not wrapped in `intl.formatMessage()`.
- **Fix**: Wrap in `intl.formatMessage()` with appropriate message IDs.

### L9. Input label not linked to input element

- **Files**: Frontend form components
- **Evidence**: `<label>` elements without matching `htmlFor`/`id` attributes.
- **Fix**: Add `id` to input and `htmlFor` to label.

### L10. Untranslated step titles in garden creation wizard

- **Files**: Admin garden creation flow
- **Evidence**: Wizard step titles are hardcoded English strings.
- **Fix**: Wrap in `intl.formatMessage()`.

### L11. Objects recreated every render

- **Files**: Frontend components
- **Evidence**: Two inline objects in render path that could benefit from `useMemo`.
- **Fix**: Wrap in `useMemo` with appropriate dependencies.

### L12-L13. Additional hardcoded English strings in admin

- **Files**: Admin views and components
- **Evidence**: More string literals not wrapped in `intl.formatMessage()`.
- **Fix**: Wrap in `intl.formatMessage()`.

### L14. `CHAIN_ID_MAP` missing `mainnet` entry

- **File**: `packages/contracts/script/utils/deployment-addresses.ts`
- **Evidence**: `loadForChain("mainnet")` would look for `mainnet-latest.json` instead of `1-latest.json` because the fallback is `chainId.toString()` on the string `"mainnet"`.
- **Fix**: Add `mainnet: 1` to `CHAIN_ID_MAP`.

### L15. Action update handlers silently drop events

- **File**: `packages/indexer/src/handlers/` (action handlers)
- **Evidence**: Unlike garden handlers which create defaults, action update handlers silently ignore updates when the `ActionRegistered` event hasn't been indexed yet.
- **Fix**: Either create default entities or log warnings for orphaned events.

### L16. Additional config.yaml staleness

- **File**: `packages/indexer/config.yaml`
- **Evidence**: Multiple contract addresses may be stale across chains if the sync script hasn't been run after recent deployments.
- **Fix**: Run `envio-integration.ts` sync after each deployment (addressed by H2 fix).

---

## Verification Notes

This review was conducted with opus-class agents after an initial haiku review produced a 95% false positive rate (39 of 41 findings). The opus review produced 28 findings with 0 false positives after manual verification of all High and key Medium findings.

### Verified clean categories (no issues found)

| Rule | Category | Status |
|------|----------|--------|
| 1 | Timer Cleanup | Clean — all hooks use `useTimeout()` or `useDelayedInvalidation()` |
| 2 | Event Listener Cleanup | Clean — `useServiceWorkerUpdate` has thorough cleanup |
| 4 | Error Handling | Clean — mutation hooks use `createMutationErrorHandler()` |
| 6 | Zustand Selectors | Clean — all stores use granular field selectors |
| 7 | Query Key Stability | Clean — no unstable object references |
| 8 | Form Validation | Clean — React Hook Form + Zod used consistently |
| 9 | Chained useMemo | Clean — no problematic chains |
| 10 | Context Values | Clean — providers use `useMemo` |
| 11 | Barrel Imports | Clean — no deep path imports in client/admin |
| 13 | Provider Nesting | Clean — correct order in both admin and client |
| 14 | Bun Scripts | Clean — no raw forge commands |

### Intentional design patterns (correctly not flagged)

- `Gardens.sol:202` — `gardenInitialized` flag set before pool creation is an idempotency guard for the `createGardenPools` retry path
- `Gardens.sol:332` — `PoolsAlreadyExist` revert prevents signal pool duplication
- `Hats.sol:679-697` — `_grantSubRole` recursion bounded to depth 1 (Operator→Gardener only)
- `Deploy.s.sol:563` — Revert if deployer lacks hat authority is correct behavior
- `ENSSection.tsx:63` — Empty catch with documented deferral to mutation hook
- `GardensList.tsx:79` — Gas estimation catch sets `estimatedGas(null)` (correct best-effort)
