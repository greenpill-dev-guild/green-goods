## Summary

**REQUEST_CHANGES.** Five Must-Fix findings prevent push readiness: incomplete receipt fingerprints, mutation-classification bypasses, receipt reuse in strict intents, unsafe shared-graph admission, and the existing readiness-gate failure.

Reviewed `d7cf681ec..01ba4e2cdeb35b06a185b8bfbf643abb4cdcaabe`: **14 commits, 350 changed paths, 7,384 changed lines**. Every commit belongs to this work, is authored by Afolabi, and carries the Claude Fable 5.1 trailer.

No tracked files changed. The branch remains `develop`; initial and final `git status --short` were empty. Review scratch files were deleted.

## Must-Fix

1. **[Critical receipts omit the effective environment] — high · validation safety · [select-validation.mjs:955](/Users/afo/Code/greenpill/green-goods/scripts/quality/select-validation.mjs:955) ·** The fingerprint records environment profile, toolchain and capability metadata, while execution inherits additional environment variables. Changing `VITEST_MAX_WORKERS` from `1` to `9` reused every cached check in the critical fixture. A separate executable probe returned cached success after that change, while fresh execution failed with exit **42**. Working-copy, command and toolchain invalidation do not cover this case. **Next step:** fingerprint the effective execution inputs—including relevant environment overrides and ignored configuration inputs—or normalize them before execution. Add a regression proving that an environment change reruns the check.

2. **[Mutation aliases and forwarded callbacks escape critical classification] — high · classification gap · [shared-mutation-surface.mjs:363](/Users/afo/Code/greenpill/green-goods/scripts/quality/shared-mutation-surface.mjs:363) ·** The analyzer follows imported calls but misses imported values referenced through local aliases or callback properties. These valid new files selected **routine** plans:
   ```ts
   import { writeContract } from "@wagmi/core";
   const submit = writeContract;
   export const send = () => submit({});
   ```
   ```ts
   import { writeContract } from "@wagmi/core";
   export const useCallback = () => ({ mutationFn: writeContract });
   ```
   A forwarded `useAuth().signOut` callback also escaped detection. The inventory guard uses the same analyzer, so it cannot catch these omissions. **Next step:** propagate mutation capability through value references and callbacks, fail conservatively on unresolved mutation-bearing constructs, and add negative fixtures both inside and outside `hooks/`. Direct calls, import aliases, named re-exports followed by calls, and literal dynamic imports passed.

3. **[Strict intents still reuse noncritical receipts] — high · requirement gap · [ci-local.js:711](/Users/afo/Code/greenpill/green-goods/scripts/dev/ci-local.js:711) ·** Receipt exclusion depends on plan risk. For a routine documentation change, repeated `readiness`, `ship`, `merge` and `release` plans reused **25, 5, 5 and 25 checks**, respectively. This contradicts the handoff and review requirement that those intents never reuse receipts. The noncritical behavior predates this range, but the promised closure is missing. **Next step:** enforce the intent restriction independently of risk, and test routine, sensitive and critical plans.

4. **[Shared-graph admission permits dependency state to leak] — high · test isolation · [vitest-shared-graph.mjs:48](/Users/afo/Code/greenpill/green-goods/scripts/lib/vitest-shared-graph.mjs:48) ·** Membership examines only the test file’s text. Imported helper mocks, module state and setup side effects are invisible. An executable two-file fixture passed with isolation enabled; both files were admitted to the shared graph, where the second failed because a dependency counter and a global written by an imported setup helper survived. The built-in guard detected neither leak. **Next step:** use explicitly certified membership or inspect dependency state and side effects conservatively. Add cross-file regression fixtures; checking resolved membership against the same source-only predicate is insufficient.

5. **[The required readiness gate remains red] — high · validation blocker · [SeedStepHowMuch.tsx:10](/Users/afo/Code/greenpill/green-goods/packages/admin/src/views/Garden/Pool/Seed/SeedStepHowMuch.tsx:10) ·** `validation-system-test` finished **338 passed, 1 failed**, rejecting the broad Shared import of `hasActionEnded`. This is the disclosed, pre-existing failure—not a regression introduced here—but the required gate has not passed. **Next step:** have its owning work restore the leaf import and rerun readiness against the resulting head.

## Should-Fix

- **[An empty small-file justification passes the guard] — medium · requirement gap · [check-small-test-files.mjs:15](/Users/afo/Code/greenpill/green-goods/scripts/quality/check-small-test-files.mjs:15) ·** The allowance regex crosses newlines. A comment ending immediately after `allow-small-test-file -` passes when followed by `it(...)`; `<reason>`, `TODO` and `reason` also pass. Legitimate reasoned subjects and four-row tables passed my probes. **Next step:** require a nonempty reason within the comment itself, reject placeholders, and test an empty comment followed by real code.

## Nice-to-Have

None.

## Remaining Gaps

The handoff, hub decision log and slice list were available. The checked-in reports supplied the timing evidence; the external Claude scorecard could not be retrieved.

| Requirement | Status | Evidence or completing step |
|---|---|---|
| D1: existing mutation paths retain critical proof | **SATISFIED** | All 130 detected mutation paths and 123 additional protected source paths selected critical CLI plans. Inventory below. |
| D1: new mutation files cannot escape classification | **MISSING** | Must-Fix 2. |
| D1: departed read-only hooks retain behavior and type proof | **SATISFIED** | All 52 paths are sensitive. Implementation paths require focused proof; the GreenWill barrel selects suite proof. Shared and consumer typechecks remain selected. |
| D1: quiet, cold critical push meets 5–7-minute target | **BLOCKED** | **UNVERIFIED independently:** sandbox loopback restrictions and lease fallback prevented a comparable complete run. The report records two 274-second runs. |
| D2: Shared-only happy-dom adoption meets the three-pair bar | **SATISFIED** | Recorded DOM improvements: 21%, 28%, 26%; unchanged assertions; five reasoned jsdom pins; Client/Admin remain on jsdom. Shuffle failures are discussed below. |
| D3: close ratchet; preserve 11 floors and global floors | **SATISFIED** | Testing guidance and architecture hub agree. Threshold block unchanged; existing parity arrays preserved. |
| D4: local commits on `develop`, publication after review | **SATISFIED** | Correct branch, authors and trailers; no publication performed. |
| D5: DetailsGate table, assertions and timeout | **SATISFIED** | File matches START exactly; one case per template; unchanged 10-second timeout. Client’s only observed failure was sandbox-related. |
| Slice 0: recorded baseline and conditions | **SATISFIED** | Commands, per-check numbers and contention are recorded. |
| Slice 1: lease behavior and worker forwarding | **SATISFIED** | 26 wrapper/lease tests passed; fallback observed; stale recovery, signals, timeout, CI bypass and nesting inspected. |
| Slice 1: paired-run timing bound | **BLOCKED** | Author’s contended samples did not establish the bound; obtain a quiet-machine measurement. |
| Slice 2: classification follow-through | **MISSING** | Existing inventory passes; alias/callback protection does not. |
| Slice 3: safe receipt reuse and serial suites | **MISSING** | Serial execution works; environment and strict-intent requirements fail. |
| Slice 4: selector routing and historical replay | **SATISFIED** | Generator/seam-input guards passed; independently replayed five historical failures. |
| Slice 5: worker override and Client proof | **SATISFIED** | Override reaches Vitest. Full Client execution: 1,480 passed; loopback test **BLOCKED**. |
| Slice 6: isolation split and lean Node setup | **MISSING** | Lean setup and preserved cases verified; membership safety fails Must-Fix 4. |
| Slice 7: DOM migration | **SATISFIED** | Dependency, assertion and pin checks passed. No newly introduced shuffle failure established. |
| Slice 8: subject-preserving folds | **SATISFIED** | No lost/renamed Shared cases or lost assertion expressions; seams and baselines preserved. |
| Slice 8: meaningful small-file allowance | **MISSING** | Should-Fix finding. |
| Slice 9: contracts gas-gate routing | **SATISFIED** | Fresh default, fresh push/release/nightly wiring, exact develop-PR cache key, and fixture execution preserved. Live cache hit remains **BLOCKED** pending CI. |
| Slice 10: test-utils leaves and consumer compatibility | **SATISFIED** | Extraction preserves behavior; Shared barrel guard passed; consumer suites/typechecks ran. |
| Slice 11: six meaningful new proofs | **SATISFIED** | All six unchanged baselines passed; every injected fault failed its intended test. |
| Slices 12–13: ratchet closure, hub and handoff | **SATISFIED** | Hub validation and status formatting passed. |
| Required local readiness | **MISSING** | Must-Fix 5; sandbox-only failures separately marked **BLOCKED**. |
| Current-head CI; historical ordered steps 3 and 5 acceptance | **BLOCKED** | Commits are unpushed. |
| Earlier ordered steps 0, 4, 6–11; unchanged settlement/Agent/mock/CSS work | **OUT_OF_SCOPE** | Already present at START; reviewed for preservation, not re-approved as new implementation. |
| Earlier guidance/browser decisions and spec test-budget rules | **SATISFIED** | Current higher-authority browser policy retained; consolidation and proof requirements applied. |
| Deferred isolation decision | **MISSING** | Measured adoption is documented, but its admission safety requires Must-Fix 4. |
| Refresh, sequencing, serial slices, subject consolidation and hub ownership decisions | **SATISFIED** | Range and records follow those boundaries. |
| Publication, Linear synchronization, external scorecard updates and runtime repairs | **OUT_OF_SCOPE** | Require the closeout/follow-up work identified in the handoff. |

## Human Call-Outs

- **Shuffle defects need a scope decision.** Three shared-graph shuffles failed `upload-preparation`. Two DOM shuffles failed existing order-dependent cases in service-worker registration, garden domains, drafts and WorkProvider. I reproduced both `upload-preparation` and the additional **WorkProvider** failure using START test sources; WorkProvider should join the handoff’s follow-up list.
- The SDK’s `BigInt.prototype.toJSON` mutation and the `offlineDownloads` assertion accepting `[object Blob]` remain separate runtime/test defects. This review made no repairs.
- The disclosed workflow-routing gaps remain: Shared wrapper changes, Client/Admin Vitest configuration parity, and consumer selection for Shared test-utils changes. Manual proof for this range does not repair future routing.
- Sensitive changes include manifests/lockfile, workflows, validation policy, harness code and agent guidance. The manifest change is only approved happy-dom; **11,194 existing dependency/optional-dependency edges retain their versions**.
- Rendered proof: **none**. This range changes test/tooling behavior rather than visible application behavior. Current-head CI and the production-cache hit remain unobserved.
- The preferred built-in code-review engine was unavailable; the three review passes were performed directly.

## Verification

Tested head: `01ba4e2cdeb35b06a185b8bfbf643abb4cdcaabe`. Review completed **2026-09-28 18:09:40 UTC**.

The required changed-file list and readiness plan were rendered, then executed:

```sh
git diff --name-only START..END | paste -sd, -
bun run check --plan -- --intent readiness --changed <range-paths>
bun run check -- --intent readiness --changed <range-paths>
bun run check -- --intent readiness --no-fail-fast --changed <range-paths>
```

The plan retained the complete critical override: **29 checks, uncapped, 1,653-second estimate**. The second execution collected the remaining stages after the known validation-system failure.

| Check | Observed result |
|---|---|
| Format, lint, test-quality, ABI artifacts | Passed |
| Validation-system tests | **338 passed, 1 failed**: Must-Fix 5 |
| Shared | **6,075 passed, 17 skipped**; typechecks/build passed |
| Client | **1,480 passed, 1 blocked**; test typecheck/build passed |
| Admin | **1,108 passed**; test typecheck/build passed |
| Agent | **333 passed, 1 skipped** across its lanes; typechecks/build passed |
| Indexer | Build passed; test failures **BLOCKED** by loopback binding |
| Contracts | Build, version and static lint passed; **2,091 Solidity tests and 3 production gas fixtures passed** |
| Contracts script suite | **280 passed, 11 skipped**; one integration suite **BLOCKED** by loopback access |
| Focused gas-gate tests | **6 passed** |
| Contracts command tests | **30 passed** |
| Docs authority/tests/build/generated projections | Passed |
| Guidance and supply-chain checks | Passed |
| Plan hubs / status JSON formatting | **24 hubs validated; both status files formatted** |
| Source structure / staged modules / seams | Passed; baselines unchanged, 7 staged modules isolated, 4 certified seams without drift |

Sandbox errors were preserved as blockers, not regressions:

- Client/Indexer: `Error: listen EPERM: operation not permitted 127.0.0.1`
- Contracts integration: `Error: connect EPERM 127.0.0.1:3012 - Local (0.0.0.0:0)`
- Lease fallback: `test lease: cannot write .../.git/green-goods-test-lease (EPERM); running without a machine slot and with a conservative worker cap.`

Additional proof:

- `bun run --cwd packages/client test --maxWorkers 1`: **1,480 passed**, same sandbox-only watcher failure.
- Shared `--sequence.shuffle`: seeds **4101, 4102, 4103** for the shared graph; **5101, 5102** for DOM. Failures are described above.
- Six `vitest related <file> --run --config <scratch>` baseline/fault pairs:

  | Subject | Baseline tests | Injected decision caught |
  |---|---:|---|
  | Login controller | 7 passed | Recovery account mismatch notification removed |
  | File upload | 13 passed | Compression selection bypassed |
  | Wallet toasts | 848 passed | Signing toast no longer persistent |
  | Vault history | 54 passed | Pagination increment changed |
  | Signal pool | 45 passed | Registration exposed during read failure |
  | Cookie Jar workspace | 57 passed | Created address no longer applied |

- Static comparison against START: **no lost/renamed Shared test names; all 26,824 existing assertion expressions retained**.
- No timeout increases, new retries, `.skip` or `.only` execution changes found. DetailsGate matches START.
- Receipt tests cover content-edit invalidation, command/toolchain changes and failed-run exclusion; additional adversarial probes exposed the missing environment and intent boundaries.
- Budget changes preserved selected check sets in representative routine/sensitive cases. Two plans intentionally became runnable because their complete suites now fit the estimate: deleted Agent test proof and Docs audit tests.
- Historical replay: [`aaf99ef5d0`](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36358936031) and [`3b45b0cdae`](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36302270336) select `docs-generated` from their own paths; [`fd638a37bb`](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36299712524), [`dfb022bc71`](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36298691522) and [`8d44b0d397`](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36297824356) select `docs-authority` from their PR branch diff.
- Timing conditions: initial load **2.96 / 2.15 / 1.72**, swap **11,669.69 MB used of 13,312 MB**, and no other matching Vitest/gate process at the initial probe. Later concurrent review suites were contended and were not treated as performance measurements.

**Safety facts**

| Invariant | Consumers | Proof level and limit |
|---|---|---|
| Mutation-bearing changes always retain critical proof | Shared hooks/modules and downstream applications | **EXECUTED, falsified for aliases/callbacks.** Existing protected inventory passes. |
| Gas evidence still executes against production codegen with fresh release/nightly builds | Contracts PR, release and nightly gates | **EXECUTED locally / PATH_TRACED in workflows.** Three fixtures and six routing tests passed; hosted cache behavior awaits CI. |

**Coverage ledger**

All **352 old/new path entries**—350 rename-aware changed paths—were covered; **zero remain**.

| Batch | Scope | Changed lines |
|---|---|---:|
| 1 | Guidance, workflows and hub decisions | 329 |
| 2a / 2b | Follow-through report, two bounded portions | 450 / 460 |
| 3 | Manifests, generated docs, Admin proofs, gas tooling, early Shared tests | 743 |
| 4 | Shared configuration and hook proofs | 730 |
| 5 | Remaining hooks, modules and provider proofs | 703 |
| 6 | Stores, setup and test utilities | 711 |
| 7 | Folded workflow/transaction proofs, configuration and seam registry | 368 |
| 8 | Validation policy and runner | 615 |
| 9 | Runner tests and package commands | 680 |
| 10 | Lease and quality guards | 645 |
| 11 | Selector tests and mutation analyzer | 727 |
| 12 | Performance parity and Turbo | 223 |

**Critical-plan inventory**

For every file below, I ran:

```sh
node scripts/dev/node-cli.js scripts/dev/ci-local.js \
  --intent push --plan-json --changed <file>
```

All **253** selected critical plans. This includes the 130 detected mutation paths plus all additional source files protected by the auth/work/queue/vault prefixes; it is deliberately broader than the mutation-only set.

| Directory | Files |
|---|---|
| [config](/Users/afo/Code/greenpill/green-goods/packages/shared/src/config) | passkeyServer.ts |
| [hooks/action](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/action) | useActionOperations.ts |
| [hooks/admin-ui](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui) | useAdminAccessState.ts |
| [admin-ui/actions](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui/actions) | useActionEditorController.ts, useCreateActionController.ts |
| [admin-ui/community](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui/community) | useCommunityWorkspaceController.ts |
| [admin-ui/garden](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui/garden) | useCreateGardenController.ts, useGardenWorkspaceController.ts, useManageMembersController.ts, useSubmitWorkController.ts |
| [admin-ui/hub](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui/hub) | useCreateAssessmentController.ts, useHubWorkbenchController.ts |
| [admin-ui/hypercerts](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui/hypercerts) | useWizardData.ts |
| [admin-ui/layout](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui/layout) | useAccountProfileController.ts |
| [admin-ui/pool](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/admin-ui/pool) | useCommitmentDialogController.ts, useCommitmentSettlementController.ts, useHubConfirmQueueController.ts, usePoolConsoleController.ts, useProtocolFundingOperationsController.ts, useSettlementOperationsController.ts |
| [hooks/assessment](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/assessment) | useCreateAssessmentWorkflow.ts |
| [hooks/auth](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/auth) | useAuth.ts, useAuthActor.ts, useIdentityChangeReset.ts, usePrimaryAddress.ts, useUser.ts, useWalletModalOpen.ts, useWalletRestoreLifecycle.ts |
| [hooks/blockchain](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/blockchain) | useContractTxSender.ts, useSendToken.ts, useTransactionSender.ts |
| [client-ui/auth](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/client-ui/auth) | useLoginScreenController.ts |
| [client-ui/commitment](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/client-ui/commitment) | useCommitmentComposerController.ts, useGardenCommitmentController.ts, useProofComposerController.ts |
| [client-ui/pool](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/client-ui/pool) | useGardenPoolController.ts |
| [client-ui/work](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/client-ui/work) | useCommunityGardenOnramp.ts, useWorkDetailController.ts, useWorkSubmissionFlowController.ts |
| [hooks/commitment-pooling](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/commitment-pooling) | useCommitmentJobs.ts, useCommitmentMutations.ts, useCommitmentPoolMutations.ts, useCommitmentPoolSetupSequence.ts, useCredit.ts, useSettlement.ts |
| [hooks/conviction](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/conviction) | useAllocateHypercertSupport.ts, useConvictionWeightAllocator.ts, useCreateGardenPools.ts, useDeregisterHypercert.ts, useRegisterHypercert.ts, useSetConvictionStrategies.ts, useSetDecay.ts, useSetPointsPerVoter.ts, useSetRoleHatIds.ts |
| [hooks/cookie-jar](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/cookie-jar) | useCampaignCookieJar.ts, useCookieJarAdmin.ts, useCookieJarDeposit.ts, useCookieJarWithdraw.ts |
| [hooks/ens](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/ens) | useENSClaim.ts, useENSReleaseName.ts |
| [hooks/garden](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/garden) | createGardenOperation.ts, useAutoJoinRootGarden.ts, useCreateGardenWorkflow.ts, useGardenDetailData.ts, useGardenInvites.ts, useGardenJoinRequests.ts, useGardenOperations.ts, useJoinGarden.ts, useKarmaIntegration.ts, useOpenMinting.ts, useSetGardenDomains.ts, useUpdateGarden.ts |
| [hooks/gardener](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/gardener) | useGardenerProfile.ts |
| [hooks/greenwill](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/greenwill) | useClaimGreenWillBadge.ts |
| [hooks/hypercerts](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/hypercerts) | useBatchListForYield.ts, useCancelListing.ts, useCreateListing.ts, useMarketplaceApprovals.ts, useMintHypercert.ts |
| [hypercerts/services](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/hypercerts/services) | build-and-sign.ts, register-in-signal-pool.ts |
| [hooks/profile](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/profile) | useProfileAvatar.ts |
| [hooks/vault](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/vault) | useAllVaultDeposits.ts, useBatchConvertToAssets.ts, useDepositForm.ts, useEmergencyPause.ts, useEnableAutoAllocate.ts, useFunderLeaderboard.ts, useGardenVaults.ts, useHarvest.ts, useHarvestableYield.ts, useMyVaultDeposits.ts, useOctantVaultHarvestableYield.ts, useOctantVaultPositions.ts, useOctantVaultProjectSupportMetric.ts, useOctantVaultStats.ts, useOctantVaultStrategyApy.ts, useOctantVaultWalletBalances.ts, useOctantVaultWalletEndow.ts, useOctantVaultWithdraw.ts, useStrategyRate.ts, useVaultDeposit.ts, useVaultDeposits.ts, useVaultEvents.ts, useVaultOperations.ts, useVaultPreview.ts, useVaultWithdraw.ts, useWrapEthToWeth.ts, vault-helpers.ts |
| [hooks/work](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work) | gardenWorkListQuery.ts, useAggregatedApprovals.ts, useBatchWorkApproval.ts, useCrossGardenQueue.ts, useDeferredHeicConversion.ts, useDraftAutoSave.ts, useDraftResume.ts, useDrafts.ts, useGardenReviewQueue.ts, useMyWorks.ts, useNeedsReview.ts, usePendingReviewCount.ts, usePendingWorksCount.ts, usePlatformStats.ts, useQueueConfirmationSync.ts, useQueuedWorkActions.ts, useQueuedWorkPreviews.ts, useReviewerGardenIds.ts, useSendingWorkIds.ts, useSubmissionProgress.ts, useWorkApproval.ts, useWorkApprovalActions.ts, useWorkApprovalLifecycle.ts, useWorkApprovals.ts, useWorkAudioRecording.ts, useWorkDraftRetirement.ts, useWorkForm.ts, useWorkImages.ts, useWorkMetadata.ts, useWorkMutation.ts, useWorkMutation.types.ts, useWorkMutationWithProgress.ts, useWorkSubmissionFlow.ts, useWorkUploadPreparation.ts, useWorkUploads.ts, useWorks.ts, workSubmissionFeedback.ts |
| [hooks/yield](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/yield) | useAllocateYield.ts, useHarvestDistribution.ts |
| [modules/action](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/action) | action-operation-command.ts |
| [modules/assessment](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/assessment) | create-assessment-command.ts |
| [modules/auth](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/auth) | account-message-signer.ts, session.ts, smartAccountClientResolver.ts |
| [modules/garden](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/garden) | create-garden-command.ts, join-garden-command.ts |
| [modules/job-queue](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/job-queue) | approval-executor.ts, commitment-call-builder.ts, commitment-chain-reads.ts, commitment-landed-lookup.ts, commitment-send-record.ts, database-open.ts, db-media.ts, db-schema.ts, db.ts, default-dependencies.ts, default-instance.ts, draft-avatars.ts, draft-connection.ts, draft-db.ts, draft-snapshot.ts, draft-state.ts, event-bus.ts, evidence-publisher.ts, executor-registry.ts, failed-delete-storage.ts, index.ts, job-analytics.ts, job-executors.ts, job-maintenance.ts, job-media-conversion.ts, job-recovery.ts, lifecycle.ts, media-resource-manager.ts, ports.ts, process-job.ts, queue-policy.ts, queue-readers.ts, queue.ts, send-chain-reads.ts, send-guards.ts, stuck-work-recovery.ts, work-claims.ts, work-executor.ts |
| [modules/marketplace](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/marketplace) | client.ts, signing.ts |
| [modules/transactions](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/transactions) | chain-guard.ts, embedded-sender.ts, factory.ts, passkey-sender.ts, wallet-sender.ts |
| [modules/work](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/work) | admitted-submission.ts, bot-submission.ts, draft-lifecycle.ts, draft-upload.ts, eas-landed-lookup.ts, execution-state.ts, heic-conversion.ts, indexer-coverage.ts, legacy-draft-recovery.ts, local-status-overlay.ts, media-processing.ts, passkey-submission.ts, prepare-queued-work.ts, queued-work-draft.ts, read-work-metadata.ts, send-outcome.ts, send-with-checkpoint.ts, simulate.ts, simulation-rejected.ts, stranded-intent.ts, submission-flow.ts, submit-approval-command.ts, submit-work-command.ts, upload-kinds.ts, upload-outcome-toast.ts, upload-preparation.ts, upload-queued-work-defaults.ts, upload-queued-work.ts, upload-state.ts, work-attachments.ts, work-confirmation.ts, work-list.ts, work-submission.ts |
| [work/wallet-submission](/Users/afo/Code/greenpill/green-goods/packages/shared/src/modules/work/wallet-submission) | index.ts, receipt.ts, submit-approval.ts, submit-batch-approval.ts, submit-work.ts, types.ts |
| [providers](/Users/afo/Code/greenpill/green-goods/packages/shared/src/providers) | Auth.tsx, JobQueue.tsx, Work.tsx |
| [workflows](/Users/afo/Code/greenpill/green-goods/packages/shared/src/workflows) | auth-passkey-adapters.ts, auth-passkey-errors.ts, authActor.ts, authMachine.ts, authMachine.types.ts, authServices.ts, authStartupState.ts, createAssessment.ts, createGarden.ts, index.ts, mintHypercert.ts |

## Verdict

Resolve the five Must-Fix findings and the small-file requirement gap, then rerun the affected proofs and readiness gate. Current-head CI remains pending.

REQUEST_CHANGES
