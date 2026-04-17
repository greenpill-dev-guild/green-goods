# Agent 6: Defensive Code Removal — Findings

## Summary

Scanned all packages (shared, admin, client, agent, contracts/script, indexer/src) for:
- Empty catch blocks
- Catch-and-log-only patterns
- Catch-and-return-default patterns
- Catch-and-rethrow (no-op)
- Silent error swallowing in mutation paths

## Classification

### KEEP — Legitimate defensive patterns

These catch blocks handle genuinely unknown conditions (external APIs, browser APIs, storage I/O, user input):

1. **Storage/cache operations** (localStorage, sessionStorage, IndexedDB)
   - `packages/shared/src/utils/storage/form.ts` — All 3 catch blocks (saveFormDraft, loadFormDraft, clearFormDraft). Storage can throw (quota exceeded, private browsing). Uses `logger.warn`.
   - `packages/shared/src/utils/storage/avatar-cache.ts` — All 3 functions. localStorage can throw. Uses `debugError`.
   - `packages/shared/src/utils/storage/quota.ts` — getStorageQuota and trackStorageQuota. Storage API informational, non-critical.
   - `packages/admin/src/config/persister.ts` — All catch blocks. IndexedDB/localStorage fallback chain. Uses `debugWarn`.
   - `packages/client/src/App.tsx` — Persister catch blocks. Same pattern as admin.

2. **ENS resolution** (external RPC, can fail for many reasons)
   - `packages/shared/src/utils/blockchain/ens.ts` — fetchEnsNameForChain, fetchEnsAddressForChain, fetchEnsAvatarForChain. RPC calls to external chain. Uses `logger.debug`. Returns null is correct (name may not exist).

3. **Contract reads for optional modules** (modules may not be deployed)
   - `packages/shared/src/utils/blockchain/garden-hats.ts` — fetchHatsModuleAddress. Module may not exist. Uses `logger.error` + returns undefined.
   - `packages/shared/src/utils/blockchain/garden-modules.ts` — fetchGardensModuleAddress. Same pattern.
   - `packages/shared/src/hooks/hypercerts/hypercert-contracts.ts` — resolveHypercertContracts. Falls back to deployment artifact addresses. Uses `logger.warn`.

4. **Simulation utilities** (designed to report simulation results, not crash)
   - `packages/shared/src/utils/blockchain/simulation.ts` — simulateTransaction. Uses `parseContractError()` — the project's error pattern. Returns structured result.
   - `packages/shared/src/modules/work/simulate.ts` — Both functions. Uses `parseContractError()` and re-throws with user-friendly messages.

5. **GraphQL client** (returns {data, error} envelope by design)
   - `packages/shared/src/modules/data/graphql-client.ts` — GQLClient.query(). Returns error envelope. Uses `trackGraphQLError`.

6. **Service Worker** (browser APIs that may not be available)
   - `packages/shared/src/modules/app/service-worker.ts` — All catch blocks. SW operations are best-effort. Uses `logger`.

7. **Web Share API** (user can cancel)
   - `packages/shared/src/utils/work/workActions.ts` — shareWork. AbortError is expected (user cancellation).

8. **Merkle proof verification** (designed to return boolean)
   - `packages/shared/src/lib/hypercerts/merkle.ts` — verifyProof. `catch { return false }` is the correct semantics.

9. **EAS field parsing** (external data, can be malformed)
   - `packages/shared/src/modules/data/eas.ts` — toNumberFromField hex parsing. Returns null for unparseable data.

10. **Translation diagnostics** (console diagnostic tool)
    - `packages/shared/src/modules/translation/diagnostics.ts` — All catches. This is a diagnostic utility for browser console.

11. **Work approval parsing** (external attestation data)
    - `packages/shared/src/hooks/work/useWorkApprovals.ts` — flatMap catch. Individual attestation parse failures are logged and skipped (malformed on-chain data). Correct.

12. **Marketplace client** (optional module, may not be available)
    - `packages/shared/src/modules/marketplace/client.ts` — getClient. Returns null when marketplace is unavailable.

13. **Agent error handling** (bot must always respond to user)
    - `packages/agent/src/handlers/index.ts` — handleVoice, handleText, handlePhoto. Uses classifyError + user-facing messages. Agent must never crash on user input.
    - `packages/agent/src/handlers/approve.ts` — Transaction errors. Logged + user-facing message.
    - `packages/agent/src/services/ai.ts` — Whisper model loading. Re-throws with user-friendly message.

14. **Offline-first patterns** (graceful degradation)
    - `packages/shared/src/hooks/work/useWorks.ts` — getWorkApprovals fetch failure. Correctly degrades (status may be stale). Uses `logger.warn`.
    - `packages/shared/src/hooks/work/useBatchWorkSync.ts` — markJobSynced/deleteJob. Post-transaction cleanup, non-critical. Uses `logger.warn`.
    - `packages/shared/src/hooks/work/useWorkImages.ts` — IDB load/save. Uses `logger.error` + `trackStorageError`.

15. **Slug availability** (fail-closed is correct security posture)
    - `packages/shared/src/hooks/ens/useSlugAvailability.ts` — Returns false on RPC failure. Documented as "fail closed."

16. **Community enrichment** (optional RPC enrichment of subgraph data)
    - `packages/shared/src/hooks/conviction/useGardenCommunity.ts` — Weight scheme enrichment catch. Falls back to subgraph default. Uses `logger.warn`.

17. **Contract script utilities** (CLI tools, not production paths)
    - `packages/contracts/script/utils/ipfs-uploader.ts` — Cache load/save. Non-critical cache.
    - `packages/contracts/script/deploy/anvil.ts` — isRunning check. Returns false on error.

18. **UI components** (must not crash on callback errors)
    - `packages/shared/src/components/Dialog/ConfirmDialog.tsx` — handleConfirm/handleCancel. Logs and delegates to onError prop or re-throws. Correct.
    - `packages/shared/src/hooks/app/useToastAction.ts` — Re-throws after toast. Correct.

19. **Image gateway race** (expected failures during multi-gateway resolution)
    - `packages/shared/src/components/Display/ImageWithFallback.tsx` — Race promise .catch(). Expected — shows fallback.

20. **JSON parse in useWorkMetadata** (external data can be invalid)
    - `packages/shared/src/hooks/work/useWorkMetadata.ts` — Line 66 `catch {}`. Inline JSON parse attempt before falling through to IPFS fetch. Intentional control flow.

21. **Membership check with error tracking** (network errors during membership check)
    - `packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts` — Uses `trackNetworkError`. Properly tracked.

22. **EAS encoder pooledSettled** (Promise.allSettled reimplementation)
    - `packages/shared/src/utils/eas/encoders.ts` — pooledSettled worker. Captures rejection reason in PromiseSettledResult. Correct semantics.

### REMOVE — No findings

After thorough review, no catch blocks in the codebase qualify for outright removal. The project has already been through multiple cleanup passes and follows its error handling patterns consistently.

### SIMPLIFY — Minor improvements

**S1. `packages/shared/src/utils/blockchain/garden-hats.ts:31` — logger.error should be logger.warn**
The module address not being found is not necessarily an error (module may not be deployed). Matches garden-modules.ts which also uses logger.error — both should arguably be `logger.warn` since this is an expected condition for gardens without the Hats module. However, this is a logging severity choice, not a defensive code issue.

**S2. `packages/shared/src/utils/storage/avatar-cache.ts` — Uses `debugError`/`debugWarn` instead of `logger`**
The avatar cache uses the old debug utilities instead of the structured logger. This means errors are invisible unless VITE_DEBUG_MODE is enabled. Should migrate to `logger.warn` for consistency with similar storage utilities (form.ts uses logger).

**S3. `packages/admin/src/config/persister.ts` and `packages/client/src/App.tsx` — Uses `debugWarn` instead of `logger`**
Same pattern as S2. Persister failures are invisible in production. Should use `logger.warn`.

## Conclusion

The codebase has strong error handling discipline. All catch blocks found serve legitimate purposes:
- Browser API fallbacks (storage, SW, clipboard)
- External data parsing (EAS attestations, JSON, hex values)
- RPC call failures with graceful degradation
- Proper use of parseContractError() + user-friendly messages
- Offline-first patterns that degrade gracefully

The only actionable findings are S2 and S3: migrating `debugWarn`/`debugError` to `logger.warn`/`logger.error` in avatar-cache.ts and the persisters, so production users get visibility into storage failures.
