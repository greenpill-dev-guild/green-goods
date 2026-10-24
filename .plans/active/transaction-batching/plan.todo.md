# Transaction Batching and Recovery Plan

**Feature:** `transaction-batching` · **Stage/status:** active, Phase 1 implementation
**Created/updated:** 2026-10-23 · **Implementation:** Phase 1 local source and automated evidence recorded; live gates pending

Execute in the user's order: **shared batching and recovery → garden settings → adding members → bulk work approvals**. Each phase covers passkeys and wallets. [spec.md](spec.md) owns behavior; [eval.md](eval.md) owns acceptance evidence; [status.json](status.json) owns lane state.

## Decision log

| # | Decision | Rationale |
|---|---|---|
| 1 | Build on `TransactionSender` and existing work queue | Reuse real adapters, guards, and individual job identity |
| 2 | Recovery precedes new bulk UI | Unknown sends must not become duplicate retries |
| 3 | Separate contract-native `multiAttest` from wallet atomic calls | Ordinary wallets can batch approvals without EIP-5792 |
| 4 | Use explicit capability and outcome types | Boolean flags and a single hash cannot describe all states |
| 5 | Preserve legacy sender semantics and opt callers in | Avoid enabling unrelated passkey workflows accidentally |
| 6 | Use a transaction-owned journal with existing Dexie | Durable recovery without making transport depend on work |
| 7 | Use atomic bounded groups and explicit sequential fallback | Limits and wallet capabilities differ; partial progress stays honest |
| 8 | Initial UI is admin; preserve client compatibility | Delivers the named actions without reopening the PWA redesign |
| 9 | Keep per-item domain preparation and validation | Shared transport does not own garden permissions or review meaning |
| 10 | Stage individual work decisions before bulk submission | Fewer signing requests must preserve review quality and metadata |
| 11 | No contract, schema, dependency, or account-upgrade change | Existing primitives appear sufficient; contrary evidence returns as scope change |
| 12 | Keep rollout controls independent of recovery | Disabling new submissions must not strand pending operations |

## Requirements coverage

| Requirement | Checkpoints | Acceptance | Status |
|---|---|---|---|
| Both passkey and wallet execution | 1.1–1.8 | AC-01–08 | Pending |
| Durable recovery and no blind resend | 1.1–1.8 | AC-02–07 | Pending |
| Save changed settings together | 2.1–2.3 | AC-09–10 | Pending |
| Add reviewed member list | 3.1–3.3 | AC-11–12 | Pending |
| Bulk attestations with individual outcomes | 4.1–4.5 | AC-13–16 | Pending |
| Accessible, localized progress and selection | 2.2–4.5 | AC-17 | Pending |
| Compatibility and measurable improvement | Every phase; 4.6 | AC-18–19 | Pending |

## Start gate

- [x] Obtain implementation authorization; the user authorized Phase 1 in the worktree on 2026-10-23. Refresh source and concurrent-work status, including Shared auth/session, locale, and validation tooling edits observed during planning.
- [x] Promote the hub when execution is accepted. Follow the plan skill's `linear-sync --feature transaction-batching --json` start gate and the live routing contract; PRD-1344 is the user-approved parent-only mirror in the current release project.
- [x] Read nearest package guides and current architecture/testing/validation contracts. Keep the current branch unless the user explicitly authorizes a branch action. Any authorized new branch uses `codex/`.
- [ ] Recheck installed versions, account profiles, chain allowlists, and deployed EAS/Kernel behavior. Select enabled combinations from evidence, not all theoretically supported chains.
- [ ] Identify failing behavioral proof before each code change. Record RED/GREEN in the owning handoff and machine state. Select checks with `bun run check --plan -- --intent qa --changed <paths> --test-path <surface>:<test>`; retain all critical overrides.

## Implementation checkpoints

The work is split into seven proposed PRs, so the full plan is not one implementation session. Checkpoints target two to four implementation/test files; split a checkpoint further when its actual caller or test footprint is larger. Complete and verify one coherent checkpoint before widening it. No PR is created by this plan.

### Phase 1: shared batching and recovery

**PR 1A: durable operation contract.** Highest architectural risk; no new product action yet.

- [x] **1.1 Define outcomes and compatibility.** Extend `modules/transactions/types.ts` and sender conformance tests with scoped capability, opaque batch references, pending outcomes, and confirmed-hash compatibility. Prove mixed account/chain calls are rejected and unresolved results cannot masquerade as confirmation.
- [x] **1.2 Add durable storage and claims.** Add transaction-owned journal/schema and focused storage tests. If needed, extract the bounded database opener in a separate small checkpoint, keeping current queue imports compatible. Prove reload, upgrade, storage failure, overlapping-item claims, and lease expiry behavior without changing work records.
- [x] **1.3 Add checkpointed group submission/reconciliation.** Extend `confirmation.ts` or add one cohesive batch module and tests. Persist intent before signer invocation, store references before waiting, retain every receipt, and stop at unresolved groups. Prove duplicate tab submission and interruption at each send boundary cannot cause an automatic resend.

**PR 1B: both transport adapters.** Depends on 1A.

- [x] **1.4 Implement explicit passkey atomic execution.** Update `passkey-sender.ts` and passkey/conformance tests. Preserve recipes, session checks, sponsorship rules, and existing single-call behavior. Prove default batch mode, all-or-nothing failure, UserOperation failure inside an outer successful receipt, and identity change during signing.
- [x] **1.5 Harden wallet batching.** Update `wallet-sender.ts`/reconciliation and tests. Save opaque call IDs, keep all receipts, classify pending/partial/failure, and distinguish known pre-send fallback from ambiguous submission. Prove `ready` never triggers an upgrade and a timeout never triggers fallback.
- [ ] **1.6 Wire production composition and limits.** Update `useTransactionSender` and focused composition/budget tests using the existing wallet/passkey adapters. Apply account/chain capability, group simulation, and bounded sizing including sponsorship/deployment cost. Prove no transport switch or changed group is sent without the reviewed intent.

**PR 1C: compatibility and work integration.** Depends on 1B; required before Phase 2.

- [x] **1.7 Migrate affected atomic consumers.** Audit `bundling-sender`, `commitment-pooling/creation-send.ts`, `reward-edit.ts`, and `useCommitmentPoolSetupSequence.ts`. Patch one consumer plus its existing tests per checkpoint where result/reference handling changes. Preserve current rail eligibility, per-job callbacks, sponsorship metadata, and product flow. Do not expand pool features.
- [x] **1.8 Connect work checkpoints.** Integrate the batch reference/outcome contract with `upload-queued-work`, `send-with-checkpoint`, and confirmation, using the existing upload tests. Retain individual jobs and claims, existing work-before-approval ordering, and client offline behavior. Prove journal/job recovery agrees after reload and one unresolved group stops later sends.

**Current implementation:** `TransactionSender.batches` exposes explicit execution, scoped listing, and reconciliation through the existing factory. The work queue retains its own journal/claims; optional batch references are bridged to its individual checkpoints. Domain preflight and receipt verification remain required caller ports. Native multi-attestation can use `single-call` mode without EIP-5792. No product bulk UI has been enabled.

Checkpoint 1.6 is partial: production composition, mandatory reviewed budgets, ordered wallet estimation, and passkey signing-time gas/sponsorship checks are implemented. Both Kernel profiles passed software-signed execution on an isolated fork. Authenticated device/wallet execution, configured sponsorship acceptance, and representative product action limits remain pending before enablement. See [the current compatibility evidence](handoffs/phase-1-compatibility.md) and [the foundation evidence](handoffs/phase-1.md).

**Phase exit:** AC-01–08 pass for both adapters; selected real account/chain combinations have recorded compatibility evidence or remain disabled. Existing sender, commitment, and work-upload regression proof is current. No later feature can bypass this boundary.

### Phase 2: garden settings

**PR 2: settings preparation and UI.** Depends on all Phase 1 checkpoints.

- [ ] **2.1 Prepare settings in Shared.** Extend the owning garden command and its Shared hook/tests with immutable changed-field preparation, uploaded banner reference reuse, and field outcome reconciliation. Prove unchanged fields are excluded and caller permission remains authoritative.
- [ ] **2.2 Integrate the existing editor.** Update `GardenSettingsEditor.tsx`, `gardenSettingsSave.ts`, and focused tests. Submit one supported group or durable sequential saves, show actual group/request progress, distinguish proposed/pending/saved, and restore drafts after remount. Prove rejection and reload do not lose values or repeat confirmed fields.
- [ ] **2.3 Complete presentation proof.** Add relevant story states and localized strings in bounded checkpoints; verify keyboard/focus behavior and both rail journeys. Measure requests for an identical multi-field edit before/after.

**Phase exit:** AC-09–10 and shared recovery cases pass. Demonstrate one supported group and ordinary-wallet sequential fallback. Roll out settings before enabling member batching.

### Phase 3: adding members

**PR 3: prepared member additions.** Depends on Phase 2 acceptance.

- [ ] **3.1 Prepare member calls in Shared.** Reuse/extract call preparation from `createGardenOperation.ts` and `useGardenOperations.ts` with focused tests. Resolve and freeze addresses, deduplicate role rows, recheck existing roles and caller permissions, and produce stable row IDs/outcomes. Prove invalid rows are explained and excluded only through an explicit revised selection.
- [ ] **3.2 Integrate member selection and progress.** Update `AddMembersDialog.tsx` and `CommunityMembersDialogs.tsx` plus tests. Add the batch command without losing single-row behavior, typed-entry folding, partial results, or failed-row correction. Prove successful rows stay out of retries after a later group fails.
- [ ] **3.3 Complete presentation proof.** Update member stories and localization in bounded checkpoints. Test supported passkeys, atomic wallets, ordinary-wallet fallback, and account change. Measure prompts and completion time for the same reviewed list.

**Phase exit:** AC-11–12 pass; successful additions survive retry/reload, unauthorized rows never send, and no removal behavior changes.

### Phase 4: bulk work approvals

**PR 4A: strict approval execution.** Depends on Phase 3 acceptance; no bulk UI until this lands.

- [ ] **4.1 Consolidate bulk submission.** Route `submit-approval-command.ts` through existing queued preparation, EAS builders, and common checkpointing. Migrate the wallet/passkey bulk helpers one at a time with their existing tests. Prove receipt timeout remains pending and passkey bulk sends use the same execution checks as other writes.
- [ ] **4.2 Preserve individual outcomes and explicit dispatch.** Update `useBatchWorkApproval.ts` and its tests to retain all decision metadata, item-to-attestation IDs, and pending overlays. Persist admin recovery records with explicit-send eligibility so background executors cannot auto-submit them. Prove mixed decisions, one invalid attestation, indexer delay, and reload retain correct per-item state.

**PR 4B: staged review experience and rollout.** Depends on 4A.

- [ ] **4.3 Add a bounded Shared review-selection hook.** Compose existing work validation and review data in `hooks/admin-ui/hub`; keep the large workbench controller thin. Test stable UID selection, garden/account/chain scoping, stale decisions, and filter changes. Do not repurpose commitment confirmation state.
- [ ] **4.4 Wire review staging.** Adapt `ReviewForm.tsx` and its tests to stage an explicit decision while preserving immediate single-review submission. Preserve confidence, rejection reason, feedback, verification method, and audio upload results. Prove unreviewed or incomplete items cannot become ready.
- [ ] **4.5 Wire Hub submission and progress.** Update `HubWorkQueue`, `HubWorkCard`, and owning composition in bounded checkpoints with behavior tests, then stories/locales. Keep detail opening separate from checkbox selection. Show reviewed decision counts, estimated groups, pending state, and item outcomes; never announce “approved” for an unresolved group.
- [ ] **4.6 Verify and enable incrementally.** Run the full acceptance matrix and required selector checks, record authenticated-class evidence or its exact pending limitation, and compare per-rail request counts and latency. Enable only evidenced feature/account/chain combinations using existing rollout mechanisms. Disabling new batches must leave reconciliation available.

**Phase exit:** AC-13–19 pass; no false completion or duplicate resubmission, no metadata loss, and single-review/client-upload behavior remains intact.

## Repository and delivery constraints

- Hooks remain in Shared; domain rules stay with garden/work; public imports use declared exports. Do not enlarge source-structure debt baselines.
- New strings cover en/es/pt and use the owning design/brand guidance. No technical batching jargon in routine product copy.
- No dependency installation, root-env change, contract deployment, branch change, external publication, or unrelated repair is implied.
- Any contract/profile incompatibility, concurrency-rule change, or broader client UX requirement returns as explicit new scope.
- Keep implementation status and TDD pending until the corresponding work and fresh receipts exist. Use [eval.md](eval.md) and lane handoffs for proof; documentation validation is not runtime proof.
