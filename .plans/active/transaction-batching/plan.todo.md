# Transaction Batching and Recovery Plan

**Feature:** `transaction-batching` · **Stage/status:** active, Phase 1 implementation
**Created:** 2026-10-23 · **Updated:** 2026-10-30 · **Implementation:** Phase 1 local source and automated evidence recorded; live gates pending

Execute in the user's order: **shared batching and recovery → garden settings → adding members → deposits → bulk work approvals**. Each phase covers passkeys and wallets. [spec.md](spec.md) owns behavior; [eval.md](eval.md) owns acceptance evidence; [status.json](status.json) owns lane state.

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
| 8 | Initial UI is admin; preserve client compatibility | Delivers the named actions without reopening the PWA redesign. Deposits are the one client exception, see 13 |
| 9 | Keep per-item domain preparation and validation | Shared transport does not own garden permissions or review meaning |
| 10 | Stage individual work decisions before bulk submission | Fewer signing requests must preserve review quality and metadata |
| 11 | No contract, schema, dependency, or account-upgrade change | Existing primitives appear sufficient; contrary evidence returns as scope change |
| 12 | Keep rollout controls independent of recovery | Disabling new submissions must not strand pending operations |
| 13 | Add deposits as Phase 4, after members and before bulk approvals (approved 2026-10-30) | They reach funders and gardeners and take up to three prompts. They move money, so the first live batches come from settings and members |
| 14 | Merge the foundation while nothing calls it, then prove live batches through garden settings | `develop` moved 182 merges in a week, so a parked branch keeps going stale. Unproven account and chain combinations stay disabled |

## Requirements coverage

| Requirement | Checkpoints | Acceptance | Status |
|---|---|---|---|
| Both passkey and wallet execution | 1.1–1.8 | AC-01–08 | Pending |
| Durable recovery and no blind resend | 1.1–1.10 | AC-02–07, AC-23 | Pending |
| Save changed settings together | 2.1–2.3 | AC-09–10 | Pending |
| Add reviewed member list | 3.1–3.3 | AC-11–12 | Pending |
| Approve and deposit together, with no double deposit | 4.1–4.4 | AC-20–22 | Pending |
| Bulk attestations with individual outcomes | 5.1–5.5 | AC-13–16 | Pending |
| Accessible, localized progress and selection | 2.2–5.5 | AC-17 | Pending |
| Compatibility and measurable improvement | Every phase; 5.6 | AC-18–19 | Pending |

## Start gate

- [x] Obtain implementation authorization; the user authorized Phase 1 in the worktree on 2026-10-23. Refresh source and concurrent-work status, including Shared auth/session, locale, and validation tooling edits observed during planning.
- [x] Promote the hub when execution is accepted. Follow the plan skill's `linear-sync --feature transaction-batching --json` start gate and the live routing contract; PRD-1344 is the user-approved parent-only mirror in the current release project.
- [x] Read nearest package guides and current architecture/testing/validation contracts. Keep the current branch unless the user explicitly authorizes a branch action. Any authorized new branch uses `codex/`.
- [ ] Recheck installed versions, account profiles, chain allowlists, and deployed EAS/Kernel behavior. Select enabled combinations from evidence, not all theoretically supported chains.
- [ ] Identify failing behavioral proof before each code change. Record RED/GREEN in the owning handoff and machine state. Select checks with `bun run check --plan -- --intent qa --changed <paths> --test-path <surface>:<test>`; retain all critical overrides.

## Implementation checkpoints

PR #1208 carries 1A to 1C together. Six more PRs follow: 1D, 2, 3, 4, 5A, and 5B. Checkpoints target two to four implementation/test files; split a checkpoint further when its actual caller or test footprint is larger. Complete and verify one coherent checkpoint before widening it.

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

**PR 1D: close the recovery gaps.** Depends on #1208. Found while reading it on 2026-10-30. Nothing calls this code yet, so neither gap reaches a user until Phase 2 turns it on.

- [ ] **1.9 Let a held operation end.** An `unresolved` group with no reference has no exit today: closing the tab during a signing prompt holds those items in that browser for good, and a new operation on them fails with `batch-items-held`. For passkeys, a missing reference proves nothing was broadcast, because the reference is saved before viem can submit, so that case can return to `prepared` on reload. A wallet can still approve an open prompt after the tab closes, so wallets need an explicit release that rereads domain state and asks the user to confirm. Prove both, and prove that a group with a reference is never released.
- [ ] **1.10 Always save an accepted reference.** Once a lease lapses, `save` throws `batch-claim-lost`, so a wallet ID that arrives after a long prompt stays in memory only and is gone after a reload. Switching to a phone wallet can suspend the page for that long. Add a reference-only write that needs no lease and can only fill an empty reference. Prove the lapsed-lease case, and prove a stale writer still cannot change a status.
- [ ] **1.11 Give the wallet's atomic batch code its own module.** The port removed the reasoning comments from `wallet-sender.ts` to stay under the 500-line cap for a modified file. Move capability, atomic submit, and reconcile beside `wallet-batch-status.ts`, then restore those comments and the confirmed-batch debug log. Behavior stays the same.

**Phase exit:** AC-01–08 and AC-23 pass for both adapters; selected real account/chain combinations have recorded compatibility evidence or remain disabled. Existing sender, commitment, and work-upload regression proof is current. No later feature can bypass this boundary.

### Phase 2: garden settings

**PR 2: settings preparation and UI.** Depends on all Phase 1 checkpoints.

- [ ] **2.1 Prepare settings in Shared.** Extend the owning garden command and its Shared hook/tests with immutable changed-field preparation, uploaded banner reference reuse, and field outcome reconciliation. Set this action's `BatchBudget` from a measured fork run, not a guess. Prove unchanged fields are excluded and caller permission remains authoritative.
- [ ] **2.2 Integrate the existing editor.** Update `GardenSettingsEditor.tsx`, `gardenSettingsSave.ts`, and focused tests. Submit one supported group or durable sequential saves, show actual group/request progress, distinguish proposed/pending/saved, and restore drafts after remount. Prove rejection and reload do not lose values or repeat confirmed fields.
- [ ] **2.3 Complete presentation proof.** Add relevant story states and localized strings in bounded checkpoints; verify keyboard/focus behavior and both rail journeys. Measure requests for an identical multi-field edit before/after. With the user's approval to broadcast, prove one live group on each rail: this closes the rest of checkpoint 1.6.

**Phase exit:** AC-09–10 and shared recovery cases pass. Demonstrate one supported group and ordinary-wallet sequential fallback. Roll out settings before enabling member batching.

### Phase 3: adding members

**PR 3: prepared member additions.** Depends on Phase 2 acceptance.

- [ ] **3.1 Prepare member calls in Shared.** Reuse/extract call preparation from `createGardenOperation.ts` and `useGardenOperations.ts` with focused tests. Resolve and freeze addresses, deduplicate role rows, recheck existing roles and caller permissions, and produce stable row IDs/outcomes. First read whether the live Hats modules have `grantRoles`: its source has the same permission check and skips held roles, so one call in `single-call` mode would give every wallet one signature, at the cost of one bad row failing the whole group. Prove invalid rows are explained and excluded only through an explicit revised selection.
- [ ] **3.2 Integrate member selection and progress.** Update `AddMembersDialog.tsx` and `CommunityMembersDialogs.tsx` plus tests. Add the batch command without losing single-row behavior, typed-entry folding, partial results, or failed-row correction. Prove successful rows stay out of retries after a later group fails.
- [ ] **3.3 Complete presentation proof.** Update member stories and localization in bounded checkpoints. Test supported passkeys, atomic wallets, ordinary-wallet fallback, and account change. Measure prompts and completion time for the same reviewed list.

**Phase exit:** AC-11–12 pass; successful additions survive retry/reload, unauthorized rows never send, and no removal behavior changes.

### Phase 4: deposits

**PR 4: approve and deposit together.** Depends on Phase 3 acceptance. [The specification](spec.md#phase-4-deposits) owns the behavior.

- [ ] **4.1 Prepare the vault deposit group.** In `useVaultDeposit.ts`, finish the limit, preview, and allowance reads, then freeze the reset (only when the allowance is nonzero and too low), the exact-amount approval, and the deposit for one account and chain. Set the budget from a measured fork run. Prove the reset case, the enough-allowance case, and that a changed amount is a new operation.
- [ ] **4.2 Send it through the batch boundary and verify it.** Use atomic mode when the capability reads `supported`, and sequential mode otherwise. Confirm from a receipt's `Deposit` event that matches the vault, depositor, receiver, and amount. Prove a reverted atomic group leaves no allowance, an unknown outcome holds the next deposit into that vault across a reload, and a confirmed deposit does not.
- [ ] **4.3 Apply it to cookie jars.** Move `useCookieJarDepositMutation.ts` from the deprecated `useContractTxSender` to `useTransactionSender` and the same boundary. Share a helper only if both flows turn out to hold the same rule; only the vault resets its allowance today.
- [ ] **4.4 Update progress on every surface.** Cover `EndowmentSheet`, `PublicFundingCard`, `PublicCookieJarCard`, and the admin `DepositModal` and `CookieJarDepositModal`, with stories and en/es/pt strings. Say how many signatures come up front, show each one landing on plain wallets, and show an unknown outcome as pending, never as failed. Measure prompts per rail before and after.

**Phase exit:** AC-20–22 pass on both rails. No double deposit from a retry, and the signature count on screen matches what the wallet asks for.

### Phase 5: bulk work approvals

**PR 5A: strict approval execution.** Depends on Phase 4 acceptance; no bulk UI until this lands.

- [ ] **5.1 Consolidate bulk submission.** Route `submit-approval-command.ts` through existing queued preparation, EAS builders, and common checkpointing. Migrate the wallet/passkey bulk helpers one at a time with their existing tests. Prove receipt timeout remains pending and passkey bulk sends use the same execution checks as other writes.
- [ ] **5.2 Preserve individual outcomes and explicit dispatch.** Update `useBatchWorkApproval.ts` and its tests to retain all decision metadata, item-to-attestation IDs, and pending overlays. Persist admin recovery records with explicit-send eligibility so background executors cannot auto-submit them. Prove mixed decisions, one invalid attestation, indexer delay, and reload retain correct per-item state.

**PR 5B: staged review experience and rollout.** Depends on 5A.

- [ ] **5.3 Add a bounded Shared review-selection hook.** Compose existing work validation and review data in `hooks/admin-ui/hub`; keep the large workbench controller thin. Test stable UID selection, garden/account/chain scoping, stale decisions, and filter changes. Do not repurpose commitment confirmation state.
- [ ] **5.4 Wire review staging.** Adapt `ReviewForm.tsx` and its tests to stage an explicit decision while preserving immediate single-review submission. Preserve confidence, rejection reason, feedback, verification method, and audio upload results. Prove unreviewed or incomplete items cannot become ready.
- [ ] **5.5 Wire Hub submission and progress.** Update `HubWorkQueue`, `HubWorkCard`, and owning composition in bounded checkpoints with behavior tests, then stories/locales. Keep detail opening separate from checkbox selection. Show reviewed decision counts, estimated groups, pending state, and item outcomes; never announce “approved” for an unresolved group.
- [ ] **5.6 Verify and enable incrementally.** Run the full acceptance matrix and required selector checks, record authenticated-class evidence or its exact pending limitation, and compare per-rail request counts and latency. Enable only evidenced feature/account/chain combinations using existing rollout mechanisms. Disabling new batches must leave reconciliation available.

**Phase exit:** AC-13–19 pass; no false completion or duplicate resubmission, no metadata loss, and single-review/client-upload behavior remains intact.

## Later candidates (not scheduled)

These also take several prompts on `develop` at `974b69ac9`, read from the code on 2026-10-30. Each is a small change once the pattern exists, and none is part of this plan until someone asks for it.

| Action | Prompts today | Note |
|---|---|---|
| Pool setup on passkey | up to 6 | Atomic wallets already batch this; passkeys are not wired |
| Action edit | 1–4 | IPFS upload comes first |
| Karma reconcile | 1 + N accounts | The only caller of `sendBatch` |
| Campaign jar sync | 1–3 | Grant, revoke, metadata |
| Marketplace approvals | 1–2 | Independent calls |
| Opening a seeded season | 2 | Separate even on atomic wallets |
| Add and send proof | 2 | Two queue jobs |

Others cannot simply be batched because a later call needs an earlier receipt or read: hypercert mint and pool register, linking work to a promise, harvest and split, and voucher agree and activate. Octant checkout and voucher deposits stay out of Phase 4, as [the specification](spec.md#phase-4-deposits) explains.

## Repository and delivery constraints

- Hooks remain in Shared; domain rules stay with garden/work; public imports use declared exports. Do not enlarge source-structure debt baselines.
- New strings cover en/es/pt and use the owning design/brand guidance. No technical batching jargon in routine product copy.
- No dependency installation, root-env change, contract deployment, branch change, external publication, or unrelated repair is implied.
- Any contract/profile incompatibility, concurrency-rule change, or broader client UX requirement returns as explicit new scope.
- Keep implementation status and TDD pending until the corresponding work and fresh receipts exist. Use [eval.md](eval.md) and lane handoffs for proof; documentation validation is not runtime proof.
