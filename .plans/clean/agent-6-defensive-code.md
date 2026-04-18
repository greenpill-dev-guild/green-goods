# Agent 6: Over-Defensive Code Assessment (DRY-RUN)

Scope: `packages/{shared,client,admin,agent,indexer,ops}/src`. Tests, node_modules, generated code excluded.

## Executive Summary

| Category | Source-code occurrences | Verdict |
|---|---|---|
| Empty `catch (e) {}` | **0** | None in src/ — only in vendored `node_modules` |
| Bare `catch {}` (anonymous, no body) | **0** | None |
| Bare `catch { ... }` (anonymous with body) | ~55 total (shared ~30 / client ~15 / admin ~10) | Mostly legitimate `JSON.parse` / API guards |
| `catch (...)` blocks with bodies | ~440 at source level | Majority route through `logger` / `toastService` / `track*` / re-throw |
| Log-only catches where the error should propagate | **3 critical** | See §1 |
| `??` fallbacks total | 501 | Hot files listed below |
| Chained `?.x?.y` | 45 | Mostly legitimate on narrowed unions |
| `console.*` in production paths (non-logger) | **2** | `AppSettings.tsx` DEV-gated |
| `throw new Error(...)` | 232 | 6 custom Error subclasses defined |

**Top 5 offenders (files worth closer review):**
1. `/Users/afo/Code/greenpill/green-goods/packages/shared/src/providers/Work.tsx:280-289` — mutation error silently swallowed when DEBUG disabled
2. `/Users/afo/Code/greenpill/green-goods/packages/admin/src/components/Hypercerts/CreateListingDialog.tsx:93-98` — mutation failure logged only, user stuck in progress phase
3. `/Users/afo/Code/greenpill/green-goods/packages/shared/src/providers/JobQueue.tsx:265-267` — bare `catch {}` with comment claiming errors are “logged in jobQueue.flush” (only partially true)
4. `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/{garden/useGardenDraft,assessment/useAssessmentDraft,hypercerts/useHypercertDraft}.ts` — identical IDB-catch shape repeated 12 times
5. `/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/data/greengoods.ts:259, 346, 385` — indexer fetchers swallow on-chain outages and return `[]`

---

## 1. HIGH-CONFIDENCE REMOVE

### 1.1 `Work.tsx:280-289` — mutation error swallowed in non-DEBUG builds
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/providers/Work.tsx`
```tsx
try {
  await workMutation.mutateAsync({ draft: draft as WorkDraft, images: imagesSnapshot });
} catch (error) {
  if (DEBUG_ENABLED) {
    debugError("[WorkProvider] mutateAsync threw", error, { gardenAddress, actionUID });
  }
}
```
Why REMOVE: `workMutation` owns the canonical work-submission flow. When `DEBUG_ENABLED` is false (production), this catch eats the error entirely — no log, no toast, no tracking. The mutation’s own `onError` handler does emit a toast, but any throw that exits `mutateAsync` AFTER `onError` ran (e.g. React Hook Form submit handler rejecting) vanishes here. Fix: either drop the try/catch (let the handler-level wrapper deal with it) or add an unconditional `logger.error(...)` and `throw error` after the debug block.

### 1.2 `CreateListingDialog.tsx:93-98` — listing failure hidden from user
File: `/Users/afo/Code/greenpill/green-goods/packages/admin/src/components/Hypercerts/CreateListingDialog.tsx`
```tsx
try {
  await createListing(params);
} catch (error) {
  logger.error("Failed to create listing", { error });
}
```
`setPhase("progress")` was set at line 79. On catch, phase stays `"progress"` indefinitely with no feedback. Compare to `AddMemberModal.tsx` / `DetailsStep.tsx` which pair `logger.error` with `setError`/`toastService.error`. Fix: reset phase and surface a toast, or consume the `error` state exposed by `useCreateListing`.

### 1.3 `JobQueue.tsx:265-267` — bare catch relying on “logged elsewhere”
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/providers/JobQueue.tsx`
```tsx
try {
  await jobQueue.flush({ transactionSender: sender, userAddress: currentUserAddress });
  if (!abortController.signal.aborted) await refreshStats(abortController.signal);
} catch {
  // Silently handle errors - they're logged in jobQueue.flush
}
```
The comment is only half right: `jobQueue.flush` logs per-job failures, not flush-setup or `refreshStats` rejections. Replace with:
```ts
} catch (error) {
  if (!abortController.signal.aborted) logger.debug("[JobQueue] attemptFlush failed", { error });
}
```

---

## 2. HIGH-CONFIDENCE SIMPLIFY (over-defensive `??` / optional chains)

### 2.1 `HubWorkCard.tsx:102` — `Work.media` is already `string[]`
File: `/Users/afo/Code/greenpill/green-goods/packages/admin/src/views/Hub/components/HubWorkCard.tsx`
```tsx
const mediaUrls = work.media ?? [];
```
`Work.media` is typed `string[]` in `packages/shared/src/types/domain.ts:407`. Drop the `??`.

### 2.2 `useHypercertWizardStore.ts:386-395` — five identical `?? []` on validated output
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/stores/useHypercertWizardStore.ts`
```ts
workScopes: validated.workScopes ?? [],
impactScopes: validated.impactScopes ?? [],
sdgs: validated.sdgs ?? [],
capitals: validated.capitals ?? [],
allowlist: validated.allowlist ?? [],
```
If `validateDraft` produces these as non-optional, the `??` is dead code. Either tighten `HypercertDraft` type or drop the validate step entirely.

### 2.3 `utils/app/garden.ts:38,43` — `(gardeners ?? []).forEach`
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/utils/app/garden.ts`
`Garden.gardeners` / `Garden.operators` are `Address[]` (non-nullable) in `domain.ts`. Fix the upstream Envio parser instead of guarding on every consumer.

### 2.4 `useGardenDetailData.ts:114-119` — six lines of `garden?.<role> ?? []`
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/garden/useGardenDetailData.ts`
If an `if (!garden) return` precedes this block, drop the `?.`. Otherwise, extract a `roleMembers(garden)` helper.

### 2.5 `chainId ?? DEFAULT_CHAIN_ID` — 8-site duplication
Sites (all with `options.chainId ?? DEFAULT_CHAIN_ID` or similar):
- `packages/shared/src/workflows/authMachine.ts:327`
- `packages/shared/src/utils/blockchain/ens.ts:125, 153, 192`
- `packages/shared/src/hooks/garden/useJoinGarden.ts:166`
- `packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts:112`
- `packages/shared/src/hooks/greenwill/useGreenWillBadges.ts:22`
- `packages/shared/src/hooks/greenwill/useGreenWillBadgeDefinitions.ts:13`
- `packages/shared/src/hooks/greenwill/useGreenWillRecentGrants.ts:14`
- `packages/shared/src/hooks/assessment/useGardenAssessments.ts:8`

CLAUDE.md states “Single Environment / Single Chain — `VITE_CHAIN_ID` at build time.” A `resolveChainId(options?)` helper (or making `chainId` required with a default arg) collapses the cluster.

---

## 3. MEDIUM — judgment calls

### 3.1 Indexer fetchers silently return `[]` — document contract
Files:
- `packages/shared/src/modules/data/greengoods.ts:259, 346, 385` (getActions, getGardens, getGardeners)
- `packages/shared/src/modules/data/marketplace.ts` (documented by header comment: all functions return graceful defaults and never throw)

Keep, but consider distinguishing indexer outage (`throw IndexerUnavailableError`) from empty result. Right now the UI can't tell "no gardens" from "indexer down".

### 3.2 `useGardenRoles.ts:44-46` — fail-closed role check
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/roles/useGardenRoles.ts`
```ts
} catch {
  return { role, hasRole: false };
}
```
Offline users appear role-less. Matches `useSlugAvailability.ts:51` pattern ("Fail closed"). KEEP but add `logger.debug(...)` for diagnostics.

### 3.3 Auth disconnect silent catch
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/providers/Auth.tsx:338-340`
```ts
} catch {
  // Ignore disconnect errors
}
```
Disconnecting an already-disconnected wallet throws. KEEP but add `logger.debug`.

### 3.4 Draft-IDB catch template repetition (12 sites)
Files (4 methods × 3 hooks):
- `packages/shared/src/hooks/garden/useGardenDraft.ts:102, 139, 186, 208`
- `packages/shared/src/hooks/assessment/useAssessmentDraft.ts:102, 134, 184, 209`
- `packages/shared/src/hooks/hypercerts/useHypercertDraft.ts:78, 110, 146, 168`

Each is legit (IDB boundary), but prime for a `makeIdbDraftOps<T>(key, source)` helper. Cross-refs Agent 1 (dedup).

### 3.5 String-matched contract error
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/cookie-jar/useCookieJarDeposit.ts:91-95`
```ts
if (error instanceof Error && error.message.includes("Insufficient token balance")) throw error;
```
Brittle — use `parseContractError(...).name === "InsufficientBalance"` (aligns with project pattern).

### 3.6 `useWorks.ts:71` — approval fetch silent
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work/useWorks.ts`
```ts
try { ... } catch (error) { warnApprovalFetchOnce(error); }
```
If the approvals query throws, works show as "pending" not "approved". Downstream comment (`status may be stale`) acknowledges this. Keep, but worth a follow-up to surface a "status freshness" UI affordance.

---

## 4. LOW / KEEP (inventory of legitimate boundary defenses)

All of the following are appropriate and should NOT be touched:

- **`JSON.parse` guards** (~20 sites: `toast.service.tsx`, CookieJar/Vault dialogs, `WorkViewSection.tsx`, `deduplication.ts`, etc.) — JSON.parse genuinely throws.
- **`parseUnits`/`parseEther`/`BigInt`** — user-typed decimals. `TreasuryDrawer`, `ConvictionDrawer`, `CookieJarDepositModal`, `SignalPool`, `WithdrawModal`.
- **`localStorage`/`sessionStorage`** — private browsing throws. `haptics.ts`, `theme.ts`, `form.ts`, `useJoinGarden.ts`.
- **`navigator.clipboard.writeText`** — permission denial. `clipboard.ts`, `AddressCopy.tsx`, `Hero.tsx`, `AddressDisplay.tsx`.
- **`URL.revokeObjectURL`** — revoking twice is harmless. `media-resource-manager.ts:75, 110, 123`.
- **Service Worker / query-persistence / IDB init** — offline-first requirement. `service-worker.ts`, `query-persistence.ts`, `client/src/App.tsx`.
- **ENS / module-address readContract** — RPC to contracts not deployed on all chains. `ens.ts`, `garden-modules.ts`, `garden-hats.ts`, `hypercert-contracts.ts`.
- **Wallet-submission / simulate paths** — wrap in typed errors (`WorkSubmissionError`, `VaultDepositStageError`). `modules/work/wallet-submission/*.ts`, `modules/work/simulate.ts`, `modules/work/passkey-submission.ts`.
- **`isAlreadyGardenerError` branching** — contract error semantically = success. `useJoinGarden.ts:317`, `useAutoJoinRootGarden.ts:233`.
- **Merkle / EAS hex parsing** — external data validation. `lib/hypercerts/merkle.ts`, `modules/data/eas.ts`.
- **Agent package** — bot must respond; uses `classifyError` + user-facing text. `agent/src/handlers/*`.
- **ENS event decoding in `useENSClaim.ts:114`** — decode against multi-event ABI, skip non-matches. Correct semantic pattern.
- **Image compression** — `utils/work/image-compression.ts:167, 227, 326` — fall back to original file. Correct.
- **Time formatters** — `utils/time.ts` many Intl API fallbacks (older browsers). Correct.

---

## 5. Pattern violations (`console.*` instead of `logger`)

### 5.1 `AppSettings.tsx:182, 187` — DEV-gated `console.debug`
File: `/Users/afo/Code/greenpill/green-goods/packages/client/src/views/Profile/AppSettings.tsx`
```ts
if (import.meta.env.DEV) console.debug("[AppRefresh] localStorage clear failed:", e);
if (import.meta.env.DEV) console.debug("[AppRefresh] IndexedDB clear failed:", e);
```
Violates `.claude/rules/typescript.md` Rule 12 ("Console.log Cleanup"). The enclosing try/catch at line 189 uses `logger.debug` correctly — inconsistent. Fix: replace with `logger.debug`; `logger` itself is DEV-aware.

### 5.2 Agent/indexer `console.*` — expected
- `packages/agent/src/config.ts:133`, `packages/agent/src/services/crypto.ts:68` — inside string literals (`"node -e \"console.log(...)\""`). Not real usages.
- `packages/indexer/src/handlers/*` — Envio runtime has no `logger`. Documented exception in the rules file.

No other production-path `console.*` found.

---

## 6. Mutation-path risks (critical to flag)

### 6.1 `Work.tsx:280-289` — **most critical**
Already in §1.1. Swallows mutation error when DEBUG is off. This is a mutation-hook caller wrapping `useWorkMutation`; the consequence is work-submission failures can fall entirely out of the reporting funnel.

### 6.2 `CreateListingDialog.tsx:93-98`
Already in §1.2. Logged but no user feedback; UI stuck in progress. Data-loss risk (user may retry, double-register).

### 6.3 `useWorks.ts:71` — approval fetch
Already in §3.6. Approvals throw → works rendered as pending. Documented as acceptable staleness.

### 6.4 Passing mutation patterns (sanity-check inventory)
- `useMintHypercert.ts:309-318` — catches `send()`, logs, re-throws. GOOD.
- `useWorkMutation.ts:203-229` — catches tx-phase network error, falls back to queue. GOOD (offline-first).
- `useWorkApproval.ts:197-203` — catches, logs, re-throws. GOOD.
- `useVaultDeposit.ts:166, 207, 250` — wraps in `VaultDepositStageError`. GOOD.
- `createGardenOperation.ts:307` — parses contract error, returns structured failure. GOOD.
- All `createMutationErrorHandler`-consuming hooks delegate properly.

No other mutation-path swallows found.

---

## Cross-agent dependencies

- **Agent 1 (dedup)**: 12× identical draft-IDB catch template in §3.4 is a prime consolidation target.
- **Agent 5 (type strengthening)**: `work.media ?? []`, `garden?.owners ?? []`, `validated.workScopes ?? []` are type-boundary issues; fixing upstream types removes the `??`.
- **Agent 7 (legacy)**: `console.debug` in `AppSettings.tsx` is a rule violation predating current lint enforcement.

## Summary counts

- **REMOVE** (silent swallow of real failures): **1** (`Work.tsx` DEBUG catch)
- **SIMPLIFY** (narrow or add logging): **3** (`CreateListingDialog`, `JobQueue` bare catch, `AppSettings` console)
- **SIMPLIFY** (drop over-defensive `??`/`?.`): ~20 identified, full count pending type-boundary audit
- **KEEP** (legitimate external boundaries): ~350 catches + ~480 `??` — dominant majority

The codebase is **well-disciplined** on error handling overall. The shared/errors module (`parseContractError`, `USER_FRIENDLY_ERRORS`, `createMutationErrorHandler`, `categorizeError`, `trackStorageError`, `trackNetworkError`, `trackUploadError`) is consistently consumed. Chronic drift from CLAUDE.md rules is minimal; primary findings concentrate in §1 (three high-impact silent catches) and §2 (type-level over-defensiveness).
