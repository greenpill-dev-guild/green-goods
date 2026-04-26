# Agent 6: Over-Defensive Code Assessment (DRY-RUN, re-verified 2026-04-18)

Scope: `packages/{shared,client,admin}/src` + `packages/contracts/src`. `agent/indexer/ops` OUT OF SCOPE. Tests, generated code excluded.

## Executive Summary

| Category | Source occurrences | Verdict |
|---|---|---|
| Empty `catch (e) {}` / `catch {}` with no body | **0** | Clean |
| Bare `catch {}` with a comment only | **1** | `JobQueue.tsx:265` — see §2 |
| Bare `catch {}` with a body (anonymous param) | 40 in TS/TSX | Mostly legitimate `parseUnits`/`BigInt`/`JSON.parse` |
| Named `catch (e) {}` blocks (prod, ex-tests) | 219 (shared 178 / client 28 / admin 13) | Majority route through `logger` + `toastService` / re-throw |
| Log-only catches (no re-throw / no UI) | ~35 distinct sites | 1 critical (mutation path), rest legitimate background tasks |
| Catch-and-return-default | ~37 sites | 3 critical (indexer fetchers) — see §5.1 |
| `??` fallbacks in src | 853 | Hot clusters in §4 |
| `console.*` in production paths (not in `logger.ts` body) | **2** | Both DEV-gated in `AppSettings.tsx:182,187` |
| Solidity `try/catch`| ~25 | All deliberate external-call guards |

**All 3 prior-run critical bugs STILL PRESENT.** No new critical mutation-path swallows. Codebase remains well-disciplined overall; primary drift concentrates in §2.

---

## 1. CRITICAL bugs (RE-VERIFIED — unchanged since prior run)

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
**Verdict REMOVE.** In production (`DEBUG_ENABLED=false`) this catch produces zero log, zero toast, zero tracking. The mutation's own `onError` (useWorkMutation.ts:477) does emit toasts and posthog tracking, so the outer catch is redundant on the happy-error path, but any throw that bypasses `onError` (e.g. synchronous validation throws, React Hook Form rejections) vanishes here. Fix: delete the try/catch entirely or add an unconditional `logger.error(...)` + `throw`.

### 1.2 `CreateListingDialog.tsx:93-98` — listing failure hidden, dialog frozen
File: `/Users/afo/Code/greenpill/green-goods/packages/admin/src/components/Hypercerts/CreateListingDialog.tsx`
```tsx
try {
  await createListing(params);
} catch (error) {
  logger.error("Failed to create listing", { error });
}
```
`setPhase("progress")` set at line 79. On catch, phase stays `"progress"` indefinitely, `preventClose={isCreating}` locks the user out. Compare with sibling `AddMemberModal.tsx:110-113` + `GardenCommunityCard.tsx:199-204` which pair `logger.error` with `toastService.error` + state recovery. Fix: add `setPhase("configure")` + `toastService.error` with a user-friendly message from `USER_FRIENDLY_ERRORS` keyed by `parseContractError(error).name`.

### 1.3 `JobQueue.tsx:265-267` — bare `catch` claiming "logged elsewhere"
File: `/Users/afo/Code/greenpill/green-goods/packages/shared/src/providers/JobQueue.tsx`
```tsx
try {
  await jobQueue.flush({ transactionSender: sender, userAddress: currentUserAddress });
  if (!abortController.signal.aborted) {
    await refreshStats(abortController.signal);
  }
} catch {
  // Silently handle errors - they're logged in jobQueue.flush
}
```
`jobQueue.flush` only logs per-job failures, not flush-setup or `refreshStats` rejections. Fix: capture as `catch (error)` + `logger.debug("[JobQueue] attemptFlush failed", { error })` (guarded on `!abortController.signal.aborted`).

---

## 2. HIGH-CONFIDENCE REMOVE (empty / log-only catches that should propagate)

Beyond §1, no additional dialog-freeze or mutation-swallow patterns found. A few other notable log-only catches inspected and confirmed LEGITIMATE (non-mutation, background/best-effort):

| File:line | Context | Status |
|---|---|---|
| `packages/client/src/App.tsx:20-73` | React Query persister localStorage/IDB best-effort | KEEP — storage failure must not break app boot |
| `packages/client/src/views/Garden/index.tsx:368-371` | `handleWorkSubmission` returns `false` on throw | KEEP — boolean status flows back to parent tab logic |
| `packages/admin/src/views/Garden/Assessment.tsx:271-274` | `parseAssessmentAttestation` returns `null` on corrupt data | KEEP — external attestation data, null-is-meaningful |
| `packages/shared/src/modules/app/service-worker.ts:163, 183` | Cache/IDB clear on unregister | KEEP — cleanup path, no rollback possible |
| `packages/shared/src/modules/translation/browser-translator.ts:141-156` | Chrome AI API fallback | KEEP — browser-capability boundary |
| `packages/shared/src/modules/job-queue/{job-maintenance,index}.ts` | IndexedDB queue diagnostics | KEEP — offline-first invariant |
| `packages/shared/src/utils/storage/form.ts:11-31` | sessionStorage read/write | KEEP — private-browsing safe |

---

## 3. HIGH-CONFIDENCE SIMPLIFY (over-defensive `??` on non-nullable types)

### 3.1 `work.media ?? []` — 4 sites, type is `string[]` (non-null)
Per `packages/shared/src/types/domain.ts:284, 407` (Work + WorkCard both declare `media: string[]`). Sites:
- `packages/shared/src/modules/data/hypercerts-attestations.ts:67`
- `packages/shared/src/modules/data/hypercerts-attestations.ts:135`
- `packages/shared/src/hooks/hypercerts/useAttestations.ts:72`
- `packages/admin/src/views/Hub/components/HubWorkCard.tsx:102`

Fix: drop the `??` or tighten the parser to guarantee non-null.

### 3.2 `garden?.(owners|operators|gardeners|evaluators|funders|communities) ?? []`
Per `packages/shared/src/types/domain.ts:137,151,159` (all `Address[]`, non-null).

Hot cluster:
- `packages/shared/src/hooks/garden/useGardenDetailData.ts:114-119` — 6 identical role fallbacks (`garden?.owners ?? []`, etc.). If a `if (!garden) return null` guard exists earlier (see line 105-110), the `?.` is dead after narrowing. Otherwise extract a `roleMembers(garden)` helper.
- `packages/client/src/views/Home/Garden/index.tsx:104-109` — 4 sites
- `packages/client/src/views/Public/{Fund,Impact}.tsx` — `g.gardeners ?? []` in flatMap
- `packages/shared/src/utils/app/garden.ts:38, 43` — params are typed `gardeners?: GardenMemberLike[]`, optional on the helper signature; KEEP the `??` at this one utility (see §4.2 — legitimate)

### 3.3 `validated.<field> ?? <fallback>` — 13 sites
File: `packages/shared/src/stores/useHypercertWizardStore.ts:384-396`
```ts
title: validated.title ?? "",
description: validated.description ?? "",
workScopes: validated.workScopes ?? [],
impactScopes: validated.impactScopes ?? [],
// ...9 more
```
Post-Zod validation, these fields should have schema-enforced defaults. Either: (a) use `z.*().default(...)` in the draft schema so `validated` is non-optional, or (b) drop the `validate` step if it's not producing a tight type. Pattern duplicated with `HypercertDraft` optional field shape upstream.

### 3.4 `chainId ?? DEFAULT_CHAIN_ID` — **20-site duplication (up from 8 in prior run)**
New + existing sites:
- `packages/client/src/views/Profile/GardensList.tsx:72`
- `packages/admin/src/views/Garden/HypercertDetail.tsx:107, 298`
- `packages/shared/src/hooks/vault/use{StrategyRate,AllVaultDeposits,VaultEvents,MyVaultDeposits,GardenVaults,VaultDeposits}.ts` — 6 files
- `packages/shared/src/workflows/authMachine.ts:327`
- `packages/shared/src/hooks/assessment/use{AllAssessments,GardenAssessments}.ts`
- `packages/shared/src/utils/blockchain/ens.ts:125, 153, 192`
- `packages/shared/src/hooks/greenwill/use{GreenWillRecentGrants,GreenWillBadgeDefinitions,GreenWillBadges}.ts`
- `packages/shared/src/hooks/garden/use{AutoJoinRootGarden,JoinGarden}.ts`

CLAUDE.md says "Single Chain — `VITE_CHAIN_ID` at build time." A `resolveChainId(options?)` helper (or renaming `chainId?: number` param to a required arg with default) collapses this cluster. Pure dedup signal — also flag to Agent 1.

---

## 4. MEDIUM — judgment calls

### 4.1 Indexer fetchers silently return `[]`
Files:
- `packages/shared/src/modules/data/greengoods.ts:259-262 (getActions), 346-349 (getGardens), 385-388 (getGardeners)`
- `packages/shared/src/modules/data/marketplace.ts:125-131, 175-182, 215-223, 255-262, 338-346, 422-*`

Logged + `return []`. KEEP but consider an `IndexerUnavailableError` or a second-channel "indexer health" signal so UI can distinguish empty from outage. Currently a stale-indexer reads as "no content," which could mask disruption during Season One pilot.

### 4.2 Self-thrown-then-string-matched contract error
File: `packages/shared/src/hooks/cookie-jar/useCookieJarDeposit.ts:89-95`
```ts
throw new Error("Insufficient token balance for deposit");
// ...
} catch (error) {
  if (error instanceof Error && error.message.includes("Insufficient token balance")) {
    throw error;
  }
  logger.warn("[CookieJarDeposit] Balance check failed, proceeding anyway", { error });
}
```
Self-thrown so the string match is safe, but the shape violates the project pattern. Suggest a sentinel error class (`BalanceCheckError`) or hoist the check out of the try/catch entirely so only `readContract` failures fall through.

### 4.3 `useGardenRoles.ts:44-46` — fail-closed role check
```ts
} catch {
  return { role, hasRole: false };
}
```
Offline → role-less. KEEP (matches `useSlugAvailability.ts` fail-closed pattern) but add `logger.debug(...)` for diagnostics (note: caller might spam this if many roles parallelized).

### 4.4 `Auth.tsx:338-340` — silent disconnect
```ts
} catch {
  // Ignore disconnect errors
}
```
Wagmi throws on already-disconnected wallets. KEEP but attach `logger.debug(...)`.

### 4.5 Draft-IDB catch template repetition (12 sites, unchanged)
- `packages/shared/src/hooks/garden/useGardenDraft.ts`
- `packages/shared/src/hooks/assessment/useAssessmentDraft.ts`
- `packages/shared/src/hooks/hypercerts/useHypercertDraft.ts`

Each 4× CRUD methods with identical catch shape. All legitimate IDB boundary defense, but prime for `makeIdbDraftOps<T>(key, source)` helper. Cross-ref Agent 1.

### 4.6 `useWorks.ts:71` — approval fetch silent
```ts
try { approvals = await getWorkApprovals(undefined, chainId); }
catch (error) { warnApprovalFetchOnce(error); }
```
Throw → works fallback to "pending" status. Documented acceptable staleness. KEEP, but consider a "freshness" UI affordance in a future pass.

---

## 5. LOW / KEEP — legitimate boundary defenses inventory

All below are appropriate and should NOT be touched:

- **`parseUnits`/`parseEther`/`BigInt`** (input validation): `CookieJarDepositModal:74`, `CookieJarWithdrawModal:68`, `WithdrawModal:93`, `SignalPool:174`, `ConvictionDrawer:105`, `TreasuryDrawer:*`, `CookieJarDepositDialog:68`, etc.
- **`JSON.parse` guards**: `WorkViewSection:51`, `Garden/Details:260`, `Home/Garden/Assessment:22`, `pinata.ts:92/163`, `error-categories:149`, `helpers.tsx:39`, `CreateAssessment:174`.
- **Auth session** (`modules/auth/session.ts:255`) — IDB wrapper.
- **Hypercerts metadata** (`hypercerts-metadata.ts:81,128`) — IPFS gateway boundary.
- **Wallet-submission** (`submit-work.ts:129`, `submit-approval.ts:88`, `submit-batch-approval.ts:98`) — wraps in typed `WorkSubmissionError`. Correct.
- **PostHog init** (`modules/app/posthog.ts:132, 178, 186, 194`) — analytics must not break prod.
- **Logger self-check** (`modules/app/logger.ts:76`) — by definition can't use logger.
- **`resolve.ts:73, 145`** (IPFS multi-gateway race) — cascading fallback.
- **`ENSSection:63`, `ens.ts:96, 107`** (ENS read) — RPC boundary.
- **`WithdrawModal`, `CookieJarTab:41`** (read-only preview) — balance-preview fallback.
- **`isAlreadyGardenerError` branching** (`useJoinGarden.ts`, `useAutoJoinRootGarden.ts`) — contract error ≡ success semantically. Correct.
- **Storage quota probes** (`utils/storage/quota.ts:223-225`) — permission denial + quota exceeded.

Also verified PASSING mutation patterns (no action needed):
- `useMintHypercert.ts:309-318` — catch, log, re-throw.
- `useWorkMutation.ts:203-229` — catch, fall back to queue with optimistic entry.
- `useWorkApproval.ts:197-203` — catch, log, re-throw.
- `useVaultDeposit.ts:166, 207, 250` — wraps in `VaultDepositStageError`.
- `createGardenOperation.ts` — parses contract error, returns structured failure.
- Hooks consuming `createMutationErrorHandler` — delegate correctly.

---

## 6. Pattern violations (`console.*` → `logger`)

### 6.1 `AppSettings.tsx:182, 187` — DEV-gated `console.debug`
File: `/Users/afo/Code/greenpill/green-goods/packages/client/src/views/Profile/AppSettings.tsx`
```ts
if (import.meta.env.DEV) console.debug("[AppRefresh] localStorage clear failed:", e);
// ...
if (import.meta.env.DEV) console.debug("[AppRefresh] IndexedDB clear failed:", e);
```
Violates `.claude/rules/typescript.md` Rule 12 (“Console.log Cleanup”). `logger.debug` is itself DEV-aware — the inline guard is redundant. Line 190 in the same function uses `logger.debug` correctly, so this is pure inconsistency. Fix: replace both with `logger.debug(... , { error: e })` (no `import.meta.env.DEV` guard needed).

No other production-path `console.*` found. All logger.ts internals + test files + documentation examples excluded. Agent/indexer packages out of scope per orchestrator.

---

## 7. Contracts (Solidity)

~25 `try/catch` blocks across `Yield.sol`, `ENSReceiver.sol`, `Octant.sol`, `*.sol` registries. All sampled usages are **deliberate external-call guards** preventing DOS/revert propagation in settings where the caller must continue:

- `Yield.sol:545-547` — `cookieJarModule.getGardenJar` optional module probe.
- `Yield.sol:597-599` — strategy counter probe (fallback to 0).
- `ENSReceiver.sol:131-135, 159-162` — ENS ops across CCIP message boundaries (documented comment confirms intent).
- `Octant.sol:144-150, 165-167` — access-control probes that default-deny on non-conforming gardens.
- `Octant.sol:253-269, 284-285, 318, 351-352, 637-650` — yield strategy lifecycle with graceful degradation (auto-retry path, shutdown idempotency, etc.).

**Verdict KEEP all** — these are canonical UUPS/external-module patterns. Low-priority; no flags.

---

## Cross-agent dependencies

- **Agent 1 (dedup)**: §3.4 (`chainId ?? DEFAULT_CHAIN_ID` × 20) + §4.5 (draft-IDB × 12) are dedup candidates.
- **Agent 5 (type strengthening)**: §3.1 (`work.media`), §3.2 (`garden.<role>`), §3.3 (`validated.*`) all vanish once domain/schema types assert non-null.
- **Agent 7 (legacy)**: `AppSettings.tsx` console.debug predates Rule 12 enforcement.

## Summary counts (post re-verify)

- **CRITICAL REMOVE** (mutation-path swallows): **3** (all carried over from prior run, none new)
- **HIGH SIMPLIFY** (drop over-defensive `??`): ~24 identified across 4 clusters
- **MEDIUM** (add logging / structural refactor): ~6 items
- **LOW / KEEP**: dominant majority (~350+ catches + 830+ `??`)

The codebase remains well-disciplined. No regressions since the prior agent-6 pass; the same 3 critical bugs remain in place because no one has edited those exact lines. Everything else in this report is refinement, not remediation.
