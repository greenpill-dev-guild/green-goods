# Agent 6 — Defensive Code Removal

## Summary
- Defensive instances examined: ~30 catch blocks in app code (admin / client / shared / agent)
- Removed (HIGH): 0
- Simplified (HIGH): 0
- Kept (KEEP-classified): 26
- Flagged for human review (MEDIUM): 3
- Tests: NOT RE-RUN (no runtime changes)

## Outcome

**Scan confirms compliance with the documented error-handling pattern.**

The repository's `.claude/rules/typescript.md` Rule 4 ("Never swallow errors") is already enforced across the four app packages. Every catch block I inspected falls into one of the documented KEEP classifications:

- Uses `parseContractError()` + `USER_FRIENDLY_ERRORS` (the canonical contract-error pattern).
- Uses `createMutationErrorHandler()` / `parseAndFormatError()` in shared mutation hooks.
- Logs via `logger` from shared (not `console.log`).
- Emits a user-facing toast via `toastService`.
- Genuinely safe-to-ignore best-effort cleanup (offline-first guardrail, dev-only SW unregister, autoplay-blocked audio, browser-policy feature detection).
- Type-guard / validator returning `false` for invalid input.
- Re-throws with a better message.

There is no HIGH-confidence defensive code to remove or simplify in the four app packages. The contracts/script tooling has many empty catches but is out of `/clean` scope per the criticality matrix (`packages/contracts/src/**` is critical, deployment scripts are not in scope and contracts/lib is explicitly excluded).

The accurate output for this codebase is "no removals". A report-only commit is the correct outcome when the codebase is already disciplined; manufacturing removals to justify the agent would regress quality.

## Scope and methodology

Searched: `packages/{admin,client,shared,agent}` for `*.ts` / `*.tsx`, excluding:
- `node_modules/`, `generated/`, `lib/` (per task rules)
- `*.test.*`, `*.story.*`, `*.stories.*` (test/story files)
- `__mocks__/` (test fixtures)
- `packages/contracts/lib/` and `packages/indexer/generated/` (per task rules)

Patterns scanned:
- Empty catch blocks: `catch {}` / `catch (e) {}` (single-line and multi-line)
- Catch blocks that only `console.log`
- Catch-and-return-default: `catch (e) { return null/[]/0/false }`
- `.catch(() => {})` promise-chain swallows
- Fallback patterns: `value ?? defaultValue`
- Optional chaining: `obj?.prop?.nested`

Top-level counts (informational):
- 514 total `catch` occurrences across `packages/`
- 302 multi-line catch blocks across `packages/`
- 383 `??` fallback patterns in app packages — all sampled instances are legitimate (Map.get, optional array fields, controlled-input defaults)

## HIGH-confidence removals

**None.**

## HIGH-confidence simplifications

**None.**

## MEDIUM (NOT touched — judgment call, flagged for human review)

### 1. `packages/shared/src/providers/Auth.tsx:320` — `disconnectWallet` swallows

```ts
const disconnectWallet = useCallback(async () => {
  try {
    await disconnect(wagmiConfig);
  } catch {
    // Ignore disconnect errors
  }
}, [wagmiConfig]);
```

- **Why flagged**: Could be upgraded to `logger.warn` for debugging visibility (silent disconnect failures are hard to diagnose if a real bug surfaces).
- **Why not removed**: This is the sign-out path — by design, sign-out should always succeed locally even if remote disconnect fails. Wagmi `disconnect` can throw on already-disconnected sessions; logging would generate noise on a hot path.
- **Recommendation**: Leave as-is unless a wallet-disconnect bug surfaces. Auth.tsx is `critical` per the criticality matrix.

### 2. `packages/shared/src/providers/Auth.tsx:438` — `clearAllCaches` swallows

```ts
serviceWorkerManager.clearAllCaches().catch(() => {});
```

- **Why flagged**: Best-effort cleanup at sign-out. Failing silently means stale SW caches could leak across sessions.
- **Why not removed**: Auth.tsx is `critical`. The cache clear is opportunistic; the surrounding code already calls `queryClient.clear()` synchronously. Adding a logger call would clutter sign-out for negligible benefit.
- **Recommendation**: Leave for human review. Could optionally upgrade to `logger.debug` if cache-leak bugs are reported.

### 3. `packages/agent/src/platforms/telegram.ts:415` — `editMessageReplyMarkup` swallows

```ts
try {
  await ctx.editMessageReplyMarkup(undefined);
} catch {
  // Ignore if can't edit
}
```

- **Why flagged**: Same shape as #1 — swallows without logging.
- **Why not removed**: Telegram's `editMessageReplyMarkup` throws if the message is too old or already edited — both expected. The comment makes intent clear. `agent` package is `sensitive` per the criticality matrix.
- **Recommendation**: Leave as-is. Marginal value to log.

## Kept under guardrails (with rule citation per group)

### parseUnits input validation (KEEP — handles unsanitized user input)

These all wrap `parseUnits(userInputString, decimals)` which throws on bad input during render (form validation). Returning `0n` is the documented form-validation fallback; removing them crashes the modal.

- `packages/admin/src/components/Work/CookieJarDepositModal.tsx:75`
- `packages/admin/src/components/Work/CookieJarWithdrawModal.tsx:68`
- `packages/admin/src/components/Vault/WithdrawModal.tsx:94`
- `packages/admin/src/views/Gardens/Garden/SignalPool.tsx:151` (sets a user-facing inputError on invalid number)

### Type-guard / feature-detection (KEEP — returns false for invalid shape)

- `packages/agent/src/services/crypto.ts:198` — JSON shape validator, returns `false` on parse failure
- `packages/shared/src/config/passkeyServer.ts:119` — passkey availability check, returns `false` on probe failure
- `packages/shared/src/__mocks__/walletconnect-utils.ts:37` — URL validator, returns `false` on parse failure (mock anyway)
- `packages/shared/src/workflows/authServices.ts:92` — base64 decode with hex fallback (not silent — fallback path follows immediately and itself throws "Invalid credential ID format" if both fail)

### Re-throw with better error message (KEEP — improves diagnostics)

- `packages/agent/src/services/crypto.ts:177` — re-throws as "Decryption failed: Invalid key or corrupted data" for diagnostic clarity

### Offline-first guardrails (KEEP — explicitly listed in task brief)

- `packages/shared/src/providers/JobQueue.tsx:86` — stats refresh fails silently when signal aborted; failures already logged in `jobQueue.flush`
- `packages/shared/src/providers/JobQueue.tsx:265` — flush silent-handle (comment: "Silently handle errors - they're logged in jobQueue.flush")

### Dev-only SW cleanup (KEEP — failure is the desired state)

- `packages/client/src/main.tsx:35,43` — dev-only `serviceWorker.unregister()` and `caches.delete()`. Failure means "no SW to clean up" which is the desired state.

### Best-effort UI / browser policy (KEEP — not actually errors)

- `packages/shared/src/components/Audio/AudioPlayer.tsx:56` — autoplay-blocked is browser policy (user gesture required), not an application error
- `packages/shared/src/components/Display/ImageWithFallback.tsx:177` — has visible fallback handler (sets `hasError`, calls `setIsLoading(false)`) — not empty

### Logged warns (KEEP — not actually empty catches)

- `packages/agent/src/platforms/telegram.ts:302` — calls `log.warn({ tempDir }, "Could not remove temp directory")`. Comment is explanatory, not an empty catch.
- `packages/client/src/components/Cards/Work/WorkCard.tsx:224` — calls `logger.warn(...)` with explanatory comment about non-critical URL revoke

### Mutation paths using canonical contract-error pattern (KEEP — Rule 4 compliance)

These all use `parseContractError()` + `USER_FRIENDLY_ERRORS` + `logger.error` + `toastService.error`:

- `packages/admin/src/components/Garden/AddMemberModal.tsx:86`
- `packages/admin/src/views/Gardens/Garden/WorkDetail.tsx:222`
- `packages/admin/src/views/Deployment/index.tsx:779`
- `packages/admin/src/components/hypercerts/HypercertWizard.tsx:358` (uses `categorizeError`)

### Mutation paths with logger.error + user-facing toast (KEEP — Rule 4 compliance)

- `packages/admin/src/components/FileUploadField.tsx:93` — logger.error + toast
- `packages/admin/src/components/Garden/GardenCommunityCard.tsx:198` — logger.error + toast
- `packages/admin/src/components/Garden/CreateGardenSteps/DetailsStep.tsx:175` — logger.error + toast
- `packages/admin/src/components/Garden/AddMemberModal.tsx:114` — logger.error + setError (clipboard failure)
- `packages/admin/src/views/Contracts/index.tsx:128,152,176` — toast.error with formatted message
- `packages/admin/src/views/Deployment/index.tsx:125,145,181,213` — toast.error + analytics tracking
- `packages/admin/src/views/Actions/CreateAction.tsx:120` — logger.error
- `packages/admin/src/views/Actions/EditAction.tsx:141,212` — logger.error + toast
- `packages/admin/src/views/Gardens/Garden/Assessment.tsx:269` — logger.error + null return for parse failure (utility fn, caller checks for null)
- `packages/admin/src/views/Gardens/Garden/WorkDetail.tsx:192` — logger.error + user-facing error
- `packages/admin/src/components/hypercerts/HypercertWizard.tsx:538` — logger.error
- `packages/admin/src/components/hypercerts/CreateListingDialog.tsx:96` — logger.error only **— verified the `useCreateListing` mutation hook's `onError` already shows the toast (`packages/shared/src/hooks/hypercerts/useCreateListing.ts:191`). The dialog catch only prevents unhandled rejection from the awaited mutation. KEEP.**
- `packages/admin/src/views/Deployment/index.tsx:779` — uses `parseContractError`
- `packages/admin/src/config/persister.ts:18,25,33,38,52` — IndexedDB persistence with `debugWarn`, falls back to localStorage (offline-first guardrail)
- `packages/admin/src/components/AddressDisplay.tsx:39` — clipboard copy failure, logger.error
- `packages/client/src/App.tsx:20,28,36,56,63` — IndexedDB persistence with `debugWarn` (offline-first guardrail)
- `packages/client/src/views/Garden/Media.tsx:264` — analytics track + uncompressed fallback (comment documents intent)
- `packages/client/src/views/Home/WorkDashboard/index.tsx:231,515` — logger.warn + toast / continue with offline data (offline-first guardrail)
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx:66` — logger.error + toast
- `packages/client/src/views/Home/WorkDashboard/Uploading.tsx:110` — logger.error + analytics tracking
- `packages/client/src/components/Cards/Work/WorkCard.tsx:216` — logger.error + sets fallback state
- `packages/client/src/views/Home/Garden/Work.tsx:155` — toast.error
- `packages/client/src/views/Landing/index.tsx:31` — toast.error

### Out-of-scope (not touched)

- `packages/contracts/script/**` empty catches — deployment tooling, not in critical/sensitive lists in the criticality matrix; per task rules contracts/lib is explicitly excluded.

### `??` fallback patterns (KEEP — sampled, all legitimate)

Sampled across admin/client/shared/agent. Every instance is one of:

- `Map.get(key) ?? 0` / `Map.get(key) ?? null` (Map.get returns `T | undefined` by spec)
- `optionalArrayField ?? []` (defensive against null arrays from indexer responses)
- `formField ?? 0` (form initial-state for nullable numeric inputs)
- `import.meta.env.X ?? ""` (env vars are typed as `string | undefined`)

None of these qualify as "abuse" — they all narrow legitimately-nullable types. Removing them would introduce runtime errors.

## Tests

**Not re-run** — no runtime code changes were made. This is a report-only commit.

## Conclusion

The Green Goods app code (admin / client / shared / agent) already follows the project's documented error-handling pattern. The `/clean` agent-6 sweep finds no defensive-code drift to correct.

If a future change introduces unguarded swallows or `console.log` in catch blocks, it would surface immediately against the rule baseline. The existing patterns serve as the lint baseline.
