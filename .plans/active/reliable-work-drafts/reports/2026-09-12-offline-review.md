# Offline work submission review

**Verdict: REQUEST_CHANGES.** Four reproducible runtime defects and one unfinished requirement remain. Repair the runtime defects before the acceptance QA pass.

Reviewed on 2026-09-12 at `develop` commit `6eef3575931d437f36889e15acb57559a9004eb8`. Source files and the branch were unchanged. The diagnostics below use real implementation modules with controlled external dependencies; no wallet transaction was sent.

## Findings

### 1. Failed passkey work can be reported as successful and removed — P1, correctness/data loss

[PasskeySender](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/transactions/passkey-sender.ts:49) treats the hash returned by `SmartAccountClient.sendTransaction` as successful execution. The installed permissionless implementation waits for a UserOperation receipt and returns its enclosing transaction hash without checking the UserOperation's `success` field. A failed account operation can be included in a successful EntryPoint transaction.

The real sender, exercised against the installed SDK action with `success: false`, resolved successfully. [executeWorkJob](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/job-queue/job-executors.ts:193) trusts that result, and the queue completion path marks the job synced and deletes its local media. Ordinary transaction receipt reconciliation also sees the enclosing transaction as successful. The gardener can lose the pending work even though no Work attestation was created.

**Next step:** preserve the UserOperation identity and check its execution receipt before declaring completion. Failed operations must retain the job and media and expose an explicit retry state. Add coverage for successful inclusion with failed execution. This sender behavior predates these commits and remains a gap in the updated passkey acceptance path.

### 2. Reconnect can submit one account's queue using another wallet — P1, account isolation

[The batch signer lookup](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work/useBatchWorkSync.ts:141) selects jobs using `primaryAddress`, then retrieves the currently connected wallet after asynchronous work. It checks only whether an account exists. There is no equality check against the queue owner or cancellation fence before sending.

An account change while the reconnect pass is in progress can leave account A's jobs in the batch and obtain wallet B as the signer. The diagnostic supplied precisely that mismatch and observed a call to the mocked wallet sender. If B is also a member of the garden, the Work resolver accepts B as the attester and A's queued job can be retired. The effect's cleanup prevents later UI updates but cannot stop an already-entered batch.

**Next step:** bind each attempt to the originating account and chain, verify the live signer matches before sending, and cancel stale attempts while preserving their queue entries. Exercise an account change across the asynchronous boundary, including a delayed upload.

### 3. Interrupted draft retirement allows a second submission — P1, duplicate work

[The online wallet branch](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/work/submit-work-command.ts:239) sends directly without checking whether the same `clientWorkId` is already queued or completed. Offline queue admission commits separately from [draft retirement](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work/useWorkDraftRetirement.ts:26). Killing the app between those commits, or a failed draft deletion, leaves both a queued job and a resumable draft.

The diagnostic queued one command offline, then resubmitted the surviving command online with the same identity. It called the direct sender. The queued copy remains eligible for reconnect batching. Draft checkpoints do not receive the batch's hash, and the Work resolver does not enforce metadata `clientWorkId` uniqueness. This breaks PRD-900's requirement to submit once.

**Next step:** reconcile draft, queue, and completed identity before selecting any submission path. Persist the admission handoff so that a residual draft cannot authorize another send. Test interruption immediately after enqueue and a rejected retirement transaction, followed by resume and reconnect.

### 4. Exhausted jobs re-enter the automatic wallet batch — P2, retry/recovery regression

[Batch candidate selection](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work/useBatchWorkSync.ts:97) excludes synced jobs and known transaction reverts, but includes unsent jobs whose retry budget is exhausted. `useWalletQueueSync` filters terminal jobs only when deciding whether to call the batch function; the batch then independently reloads every unsynced work job.

The diagnostic supplied one healthy job and one job with five attempts. Both were encoded for sending. A permanently invalid job can therefore fail the combined upload or `multiAttest` transaction and hold up otherwise valid work whenever a healthy job triggers reconnect sending.

**Next step:** apply the retry-eligibility policy inside the shared batch function, before loading media or claiming jobs. Keep explicit Retry responsible for re-enabling terminal work. Verify a mixed healthy/terminal queue sends only the healthy work and preserves the terminal entry.

## Remaining requirement gap

### 5. The unified draft schema does not include profile avatars — P2, missing acceptance

[PRD-896](https://linear.app/greenpill-dev-guild/issue/PRD-896) explicitly requires one versioned schema for every draft kind, names the avatar store, and absorbs PRD-902. Work uses `green-goods-drafts` version 2, while [profile-avatar drafts](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/profile-avatar/drafts.ts:13) still open `green-goods-profile-avatar-drafts` version 1. `useProfileAvatar` actively uses that separate store; no migration joins it to the work draft schema.

**Smallest completing step:** migrate avatar drafts into the shared versioned draft database, preserve account/chain ownership and existing bytes, and update the avatar consumer. Alternatively, obtain an explicit change to the issue's accepted scope. The current issue cannot be marked complete as written. This is unfinished scope, not evidence that the new work-photo persistence itself still uses picker handles.

## Requirements and evidence

Sources were the current issue descriptions and comments, the Reliable Work Drafts plan hub, and the implementation at the pinned commit. All three issues were In Review. Earlier plan-hub receipts were context, not reused as current passing evidence.

| Requirement | Status | Implementation/evidence and limit |
| --- | --- | --- |
| PRD-900: complete all four steps in airplane mode and see queued work | BLOCKED | Offline command, wizard, queue and dashboard paths exist and their repository tests passed. The browser spec was inspected but not executed in this review; physical-device acceptance remains outstanding. |
| PRD-900: reconnect submits once for passkey and wallet users | MISSING | Findings 1–4 contradict successful, isolated, single-submission recovery. |
| PRD-900: queued work is visible in the dashboard | SATISFIED | Queue projections, mounted previews, dashboard consumers and passing component/hook tests support this at code level. No live-device claim. |
| PRD-900: work reaches its correct final state | MISSING | Finding 1 can retire failed work as successful. Successful reconnect delivery is not covered by the current browser scenario. |
| PRD-896: picked photo survives background, kill and reopen | BLOCKED | Independent byte capture and durable snapshot restoration have passing tests. Android picker/process-lifecycle proof is still needed. |
| PRD-896: no InvalidBlob or NotReadableError reaches Sentry from the draft path | BLOCKED | The raw-handle path was replaced, but this review did not obtain a device run or production telemetry evidence establishing the absence of these errors. |
| PRD-896: one versioned schema holds every draft kind, with migration | MISSING | Finding 5. |
| PRD-896: resume and exit update the active draft in place | SATISFIED | Shared account/chain-scoped active identity, hydration and serialized snapshot tests passed. Submission retirement is the separate gap in finding 3. |
| PRD-896: retire the idb-keyval image writer | SATISFIED | New work uses the canonical snapshot path. Legacy reads/markers remain solely for explicit recovery and cleanup; no ongoing raw-picker image writer was found. |
| PRD-896: audio persists with the draft | SATISFIED | Complete snapshot and restore tests include audio bytes and removal. Physical-device audio capture/restart remains part of device acceptance. |
| PRD-867: loaded gardens remain visible and offline indicator appears | BLOCKED | Error propagation preserves cached values; shared connectivity and indicator tests passed. Required rendered desktop/Android proof was not obtained. |
| PRD-867: reconnect refreshes stale state without reload | SATISFIED | Real QueryClient/QueryObserver tests exercise offline-to-online refresh; cache retention through a failed refresh also passed. Device behavior remains unobserved. |

No additional code defect was established for PRD-867. Its cache and indicator changes have useful automated coverage.

## Safety facts

1. **Saved work fields and attachment bytes commit together.** Consumers: Client autosave, resume, draft dashboard and submission input. **Proof: EXECUTED.** The current Shared suite passed snapshot rollback, fields/audio restoration, stable attachment identity, overlapping saves, draft limits and stale-generation tests. This establishes the tested IndexedDB transaction behavior; it does not reproduce Android content-provider revocation or OS eviction. An edit still marked Saving is outside the committed-Saved guarantee.
2. **Queue completion must mean successful work by the originating account, without a second submission.** Consumers: passkey sender, job processor, wallet batch, Work mutation, draft retirement and dashboard. **Proof: DEPENDENCY_WALKED; invariant disproved by executed diagnostics.** All four added negative checks failed against the real relevant implementation. External wallet, network and database boundaries were controlled. No mainnet/testnet transaction or rendered device failure was observed.

## Verification performed at the reviewed commit

- `bun run validation:plan -- --intent review --changed-file /tmp/offline-review-files.txt --risk critical` and the readiness selector ran before validation. The critical override and each selected check's reason were inspected. The selection is saved in [offline-readiness-plan.json](/private/tmp/offline-readiness-plan.json).
- `bun run test` passed. Among its results: Shared 4,733 passed / 18 skipped; Client 1,115 passed; Admin 860 passed; Agent 311 passed / 1 skipped plus 9 SQLite tests; Indexer 320 passed; contract suites also passed. The first attempt hit sandbox loopback denial; the complete rerun with approved local-fixture access exited 0. [Full test log](/private/tmp/offline-review-tests.log).
- `bun run format:check` and `bun run lint` passed. Solidity lint emitted warnings, not errors.
- `VITE_CHAIN_ID=11155111 bun run build` passed, including Client and Admin production builds. Client PWA budgets passed: offline shell 9.57 MiB raw / 2.67 MiB gzip. This is build evidence, not proof of a service-worker install on a device. [Build log](/private/tmp/offline-review-build.log).
- Shared `bun run typecheck` and `bun run typecheck:tests`, and Client `bun run typecheck:tests`, passed.
- `bun run test:validation-system` passed 232 checks. `bun run check:test-quality` passed, including the certified seam registry check.
- `bun run agentic:check` passed, including Modern Web Guidance, design/generated-token checks, ontology, Storybook coverage and 237 story-quality files.
- `bun run --filter @green-goods/shared test -- --config /private/tmp/gg-offline-review/vitest.config.ts -t 'REVIEW:'` failed all four new diagnostics, with 46 copied baseline cases intentionally filtered out. These are failing regression demonstrations, not passing verification. [Diagnostic log](/private/tmp/offline-review-diagnostics.log), [batch checks](/private/tmp/gg-offline-review/batch.test.ts), [submission check](/private/tmp/gg-offline-review/command.test.ts), [passkey check](/private/tmp/gg-offline-review/passkey.test.ts).

The full readiness plan is not claimed green. Remaining separate readiness checks, current-head PR CI and live acceptance were not completed after the runtime blockers were established. The explicit production-readiness approval bar is therefore unmet independently of the five findings.

Authenticated Brave was reachable through the extension, but the existing local Green Goods tab returned `ERR_CONNECTION_REFUSED`; the dev service status showed the local services stopped. No alternate isolated profile was used. Physical Android/iOS verification and a successful live reconnect submission were not obtained. The existing clean-room browser test intentionally has no wallet and expects reconnect sending to fail, so it cannot establish successful delivery or passkey behavior.

## Review coverage and boundaries

The review followed three batches: draft durability; submission and recovery; offline navigation and cache. The implementation history was traced through `dc9ac58a2`, `85a186ca2`, `7bb26ff86`, `d49ac529b`, `1157ff47a`, `9552e16b2` and `2f016581a`, then checked against current HEAD and direct consumers. The union contains 151 paths including deleted/renamed paths and tests. See the [file coverage ledger](/private/tmp/gg-offline-review/coverage.md).

Runtime changes and the affected critical paths were inspected. Tests were executed as suites and inspected selectively for assertions, mocks and failure/recovery coverage; a line-by-line review of every baseline test is not claimed. Cross-boundary checks included the installed permissionless sender action, passkey client construction, Work resolver validation and the live avatar draft consumer. Unrelated commits on develop were not treated as part of these issues.

No source, package manifest, dependency, operating guidance, contract, deployment or Linear state was changed. Temporary diagnostics and review artifacts are outside the repository. Existing dependency versions were used. The reviewed implementation includes a Shared export addition in its package manifest; this review made no manifest changes.

## Acceptance QA after repairs

1. On installed Android, pick several photos and record audio, wait for Saved, background, kill and reopen offline. Resume the same draft and verify all fields, bytes and attachment order. Repeat once with HEIC, a supported video and an attachment removal.
2. Visit Home and Profile online, switch to airplane mode, verify gardens and the offline indicator, complete all four wizard steps, then restart offline and verify the queued item and its previews.
3. Reconnect separately with passkey and wallet. Verify exactly one Work attestation, correct attester, queue retirement and the final dashboard state. Repeat with a receipt timeout and an included-but-failed UserOperation.
4. During reconnect, switch wallet accounts; verify the previous account's work is retained and never sent by the new account. Repeat with one healthy and one exhausted job.
5. Interrupt immediately after queue admission and before draft deletion, then reopen and resume. Verify that the residual draft joins the existing queued/completed identity and cannot submit again.
6. Upgrade a browser with legacy work and avatar drafts, including one unreadable attachment. Verify migration, account separation, explicit recovery and preservation of readable evidence.

