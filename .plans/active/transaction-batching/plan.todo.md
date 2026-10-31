# Transaction Batching and Recovery Plan

**Feature:** `transaction-batching` · **Stage/status:** active, Phase 1 implementation
**Created:** 2026-10-23 · **Updated:** 2026-10-30 · **Implementation:** Phase 1 local source and automated evidence recorded; live gates pending

Execute in the user's order: **shared batching and recovery → garden settings → adding members → deposits → bulk work approvals**, then the remaining actions in [the slice table](#slices). Each phase covers passkeys and wallets. [spec.md](spec.md) owns behavior; [eval.md](eval.md) owns acceptance evidence; [status.json](status.json) owns lane state.

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
| 15 | Batch every action that can batch, one slice per PR (approved 2026-10-30) | The user asked for all of them. An action stays out only when a later call needs an earlier receipt or a review is deliberately separate |

## Requirements coverage

| Requirement | Checkpoints | Acceptance | Status |
|---|---|---|---|
| Both passkey and wallet execution | 1.1–1.8 | AC-01–08 | Pending |
| Durable recovery and no blind resend | 1.1–1.13 | AC-02–07, AC-23 | Pending |
| Save changed settings together | 2.1–2.3 | AC-09–10 | Pending |
| Add reviewed member list | 3.1–3.3 | AC-11–12 | Pending |
| Approve and deposit together, with no double deposit | 4.1–4.4 | AC-20–22 | Pending |
| Bulk attestations with individual outcomes | 5.1–5.5 | AC-13–16 | Pending |
| Accessible, localized progress and selection | 2.2–5.5 | AC-17 | Pending |
| Every remaining batchable action | 6.1–12.1 | AC-24–27 | Pending |
| Compatibility and measurable improvement | Every phase; 5.6 | AC-18–19 | Pending |

## Start gate

- [x] Obtain implementation authorization; the user authorized Phase 1 in the worktree on 2026-10-23. Refresh source and concurrent-work status, including Shared auth/session, locale, and validation tooling edits observed during planning.
- [x] Promote the hub when execution is accepted. Follow the plan skill's `linear-sync --feature transaction-batching --json` start gate and the live routing contract; PRD-1344 is the user-approved parent-only mirror in the current release project.
- [x] Read nearest package guides and current architecture/testing/validation contracts. Keep the current branch unless the user explicitly authorizes a branch action. Any authorized new branch uses `codex/`.
- [ ] Recheck installed versions, account profiles, chain allowlists, and deployed EAS/Kernel behavior. Select enabled combinations from evidence, not all theoretically supported chains.
- [ ] Identify failing behavioral proof before each code change. Record RED/GREEN in the owning handoff and machine state. Select checks with `bun run check --plan -- --intent qa --changed <paths> --test-path <surface>:<test>`; retain all critical overrides.

## Slices

Each slice is one PR. Signatures read "today, then after" for passkeys and atomic wallets. Plain wallets keep today's prompts unless the row says otherwise, because they can only save a signature when a contract takes a list.

| Slice | Actions | Signatures | Depends on | Why it stands alone |
|---|---|---|---|---|
| 1 | Batch engine (PR #1208, merged) | No change | | Nothing calls it |
| 1D | Recovery gaps and review findings (PR #1396, merged) | No change | 1 | Must land before anything calls the engine |
| 1E | Remaining recovery races | No change | 1D | Must land before anything calls the engine |
| 2 | Garden settings, enablement list, first live proof | 1–7, then 1 | 1E | No funds at risk; first live batches |
| 3 | Add members | N, then 1, on every wallet | 2 | Uses `grantRoles`; Arbitrum only |
| 4 | Vault and cookie jar deposits | 1–3 and 1–2, then 1 | 3 | Moves money |
| 5A | Bulk review execution | No UI yet | 4 | Strict execution before any UI |
| 5B | Staged reviews in the Hub | 1 per work, then 1 per group, on every wallet | 5A | Largest UI change |
| 6 | Pool setup on passkeys, opening a seeded season | Up to 6, then 2; 1–2, then 1 | 2 | Adds the passkey path pool callers use |
| 7 | Seed set, Add to Group, Finish Creating, Edit Reward on passkeys | 1 per copy, then 1 per group; Edit Reward starts working | 6 | These share `creationSendMode` |
| 8 | Karma reconcile, marketplace approvals | 1 + N, then 1 per group; 1–2, then 1 | 2 | Fixed calls, confirmed by reads |
| 9 | Campaign jar sync | 1–3, then 1 | 2 | Changes who can withdraw |
| 10 | Action edit | 1–4, then 1 | 2 | Upload order and its own recovery |
| 11 | Octant checkout | 1–4, then 1, atomic wallets only | 4 | Wallet only, on mainnet |
| 12 | Add and send proof | 2, then 1 | 7 | Blocked: reverses a recorded decision, see Phase 12 |

After slice 2, slices 3, 6, 8, 9, and 10 share no code and can run in parallel worktrees. Slice 4 waits for 3 only by decision 13.

## Implementation checkpoints

Checkpoints target two to four implementation/test files; split a checkpoint further when its actual caller or test footprint is larger. Complete and verify one coherent checkpoint before widening it.

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

**PR 1D: close the recovery gaps.** Depends on #1208. Found while reading it on 2026-10-30, and raised independently by its review. Nothing calls this code yet, so no user was exposed.

- [x] **1.9 Let a held operation end.** A passkey record with no reference reopens, because that reference is always saved before viem can submit, and a passkey send now refuses to go without one. Every other hold ends through `batches.release`, which reads the chain first and keeps the evidence. A reference that arrives after a release holds the items again.
- [x] **1.10 Always save an accepted reference.** A lapsed lease no longer stops its holder until another tab takes over. An accepted reference is saved by a write that needs no lease and can only add identity.
- [x] **1.11 Give the wallet's atomic batch code its own module.** Capability, atomic submit, and reconcile moved to `wallet-atomic-batch.ts`, which let `wallet-sender.ts` get its reasoning comments and debug log back. Behavior stays the same.
- [x] **1.12 Close the review findings on #1208.** A budget now applies per submitted group, saved receipts survive a later read that sees less, and a stored status that frees its items cannot sit over a live send. Operation IDs stay unscoped: they are minted per attempt, and reusing one across accounts fails closed with `batch-intent-changed`.

**PR 1E: close the remaining races.** Depends on 1D. Raised by review of #1396, and all narrow.

- [x] **1.13 Settle the races around a late reference and saved receipts.** A checkpoint keeps a reference another writer added while it was reading, and a release stops if a reference appeared after its read. Execution proven by a receipt is recorded before verification starts, so recovery can finish it after a wallet's status expires. A saved receipt and a later read that disagree keep the group unresolved, with both on the record.

**Phase exit:** AC-01–08 and AC-23 pass for both adapters; selected real account/chain combinations have recorded compatibility evidence or remain disabled. Existing sender, commitment, and work-upload regression proof is current. No later feature can bypass this boundary.

### Phase 2: garden settings

**PR 2: settings preparation and UI.** Depends on all Phase 1 checkpoints.

- [ ] **2.0 Add the enablement list.** One Shared list of action, rail, account profile, and chain that may batch, empty by default. `getBatchCapability` only checks an encoding, so it cannot decide this. Prove an unlisted combination sends as it does today, and removing one leaves recovery working.
- [ ] **2.1 Prepare settings in Shared.** Extend the owning garden command and its Shared hook/tests with immutable changed-field preparation, uploaded banner reference reuse, and field outcome reconciliation. Set this action's `BatchBudget` from a measured fork run, not a guess, and check that the configured RPC answers `simulateCalls`. `updateName` needs the owner and the others an operator, so one stale permission reverts the group: recheck before signing. Prove unchanged fields are excluded and caller permission remains authoritative.
- [ ] **2.2 Integrate the existing editor.** Update `GardenSettingsEditor.tsx`, `gardenSettingsSave.ts`, and focused tests. Submit one supported group or durable sequential saves, show actual group/request progress, distinguish proposed/pending/saved, and restore drafts after remount. Prove rejection and reload do not lose values or repeat confirmed fields.
- [ ] **2.3 Complete presentation proof.** Add relevant story states and localized strings in bounded checkpoints; verify keyboard/focus behavior and both rail journeys. Measure requests for an identical multi-field edit before/after. With the user's approval to broadcast, prove one live group on each rail: this closes the rest of checkpoint 1.6.

**Phase exit:** AC-09–10 and shared recovery cases pass. Demonstrate one supported group and ordinary-wallet sequential fallback. Roll out settings before enabling member batching.

### Phase 3: adding members

**PR 3: prepared member additions.** Depends on Phase 2 acceptance.

- [ ] **3.1 Prepare member calls in Shared.** Reuse/extract call preparation from `createGardenOperation.ts` and `useGardenOperations.ts` with focused tests. Resolve and freeze addresses, deduplicate role rows, recheck existing roles and caller permissions, and produce stable row IDs/outcomes. Send one `grantRoles` call per group in `single-call` mode, so every wallet signs once. The 23 Oct Arbitrum upgrade includes it (`packages/contracts/deployments/tx-plans/42161-hats-module-1792782642075-plan.json`), and Celo records no Hats module, so recheck the live selector before enabling. One bad row reverts the whole call, so simulate first and isolate failures the way `upload-queued-work.ts` does. Confirm by reading each hat, because `RoleGranted` fires only on a new mint. Prove invalid rows are explained and excluded only through an explicit revised selection.
- [ ] **3.2 Integrate member selection and progress.** Update `AddMembersDialog.tsx` and `CommunityMembersDialogs.tsx` plus tests. Add the batch command without losing single-row behavior, typed-entry folding, partial results, or failed-row correction. Prove successful rows stay out of retries after a later group fails.
- [ ] **3.3 Complete presentation proof.** Update member stories and localization in bounded checkpoints. Test supported passkeys, atomic wallets, ordinary-wallet fallback, and account change. Measure prompts and completion time for the same reviewed list.

**Phase exit:** AC-11–12 pass; successful additions survive retry/reload, unauthorized rows never send, and no removal behavior changes.

### Phase 4: deposits

**PR 4: approve and deposit together.** Depends on Phase 3 acceptance. [The specification](spec.md#phase-4-deposits) owns the behavior.

- [ ] **4.1 Prepare the vault deposit group.** In `useVaultDeposit.ts`, finish the limit, preview, and allowance reads, then freeze the reset (only when the allowance is nonzero and too low), the exact-amount approval, and the deposit for one account and chain. These calls omit `chainId` and `account` today, so set them. Set the budget from a measured fork run. Prove the reset case, the enough-allowance case, and that a changed amount is a new operation.
- [ ] **4.2 Send it through the batch boundary and verify it.** Use atomic mode when the capability reads `supported`, and sequential mode otherwise. Confirm from a receipt's `Deposit` event that matches the vault, depositor, receiver, and amount; `OCTANT_VAULT_ABI` lacks that event, so add it. Prove a reverted atomic group leaves no allowance, an unknown outcome holds the next deposit into that vault across a reload, and a confirmed deposit does not.
- [ ] **4.3 Apply it to cookie jars.** Move `useCookieJarDepositMutation.ts` from the deprecated `useContractTxSender` to `useTransactionSender` and the same boundary. The jar's ABI and indexer show no `Deposit` event and its source is not in this repo, so first read a real deposit's logs; the likely fallback is the ERC-20 `Transfer` into the jar plus `currencyHeldByJar`. Share a helper only if both flows turn out to hold the same rule; only the vault resets its allowance today.
- [ ] **4.4 Update progress on every surface.** Cover `EndowmentSheet`, `PublicFundingCard`, `PublicCookieJarCard`, and the admin `DepositModal` and `CookieJarDepositModal`, with stories and en/es/pt strings. Say how many signatures come up front, show each one landing on plain wallets, and show an unknown outcome as pending, never as failed. Measure prompts per rail before and after.

**Phase exit:** AC-20–22 pass on both rails. No double deposit from a retry, and the signature count on screen matches what the wallet asks for.

### Phase 5: bulk work approvals

**PR 5A: strict approval execution.** Depends on Phase 4 acceptance; no bulk UI until this lands.

- [ ] **5.1 Consolidate bulk submission.** Route `submit-approval-command.ts` through existing queued preparation, EAS builders, and common checkpointing. Migrate the wallet/passkey bulk helpers one at a time with their existing tests. Prove receipt timeout remains pending and passkey bulk sends use the same execution checks as other writes.
- [ ] **5.2 Preserve individual outcomes and explicit dispatch.** Update `useBatchWorkApproval.ts` and its tests to retain all decision metadata, item-to-attestation IDs, and pending overlays. Admin mounts no job queue provider, so its recovery records live in the batch journal, where no background executor can submit them. Prove mixed decisions, one invalid attestation, indexer delay, and reload retain correct per-item state.

**PR 5B: staged review experience and rollout.** Depends on 5A.

- [ ] **5.3 Add a bounded Shared review-selection hook.** Compose existing work validation and review data in `hooks/admin-ui/hub`; keep the large workbench controller thin. Test stable UID selection, garden/account/chain scoping, stale decisions, and filter changes. Do not repurpose commitment confirmation state.
- [ ] **5.4 Wire review staging.** Adapt `ReviewForm.tsx` and its tests to stage an explicit decision while preserving immediate single-review submission. Preserve confidence, rejection reason, feedback, verification method, and audio upload results. Prove unreviewed or incomplete items cannot become ready.
- [ ] **5.5 Wire Hub submission and progress.** Update `HubWorkQueue`, `HubWorkCard`, and owning composition in bounded checkpoints with behavior tests, then stories/locales. Keep detail opening separate from checkbox selection. Show reviewed decision counts, estimated groups, pending state, and item outcomes; never announce “approved” for an unresolved group.
- [ ] **5.6 Verify and enable incrementally.** Run the full acceptance matrix and required selector checks, record authenticated-class evidence or its exact pending limitation, and compare per-rail request counts and latency. Enable only evidenced feature/account/chain combinations using existing rollout mechanisms. Disabling new batches must leave reconciliation available.

**Phase exit:** AC-13–19 pass; no false completion or duplicate resubmission, no metadata loss, and single-review/client-upload behavior remains intact.

### Phase 6: pool writes on passkeys

**PR 6.** Depends on slice 2.

- [ ] **6.1 Give passkeys the path pool callers use.** Add budget-carrying `sendAtomicBatch` and `canSendAtomicBatch` to `PasskeySender`, gated by the enablement list, because pool setup probes for them and would otherwise switch on for everyone at once. Prove a listed combination batches and an unlisted one still sends one call at a time.
- [ ] **6.2 Batch pool setup.** In `useCommitmentPoolSetupSequence.ts`, the writes before opening go together. `openCycle` follows on its own because its ID comes from the seeding receipt, and the counter is global, so never predict it. Prove a first run takes 2 prompts on a passkey and a retry repeats only what did not land.
- [ ] **6.3 Batch opening a seeded season.** Stop grouping only at a `"seeded"` cycle ID, so `openPool` and an `openCycle` with a known ID go together. Atomic wallets gain this too. Keep `setupWrites.ts` counting the same signatures the wallet asks for.

**Phase exit:** AC-24 passes on passkeys and atomic wallets; plain wallets still take every step.

### Phase 7: creations and rewards

**PR 7.** Depends on slice 6.

- [ ] **7.1 Batch creations on passkeys.** Send Seed set, Add to Group, and Finish Creating through `creationSendMode` and `bundling-sender`, where passkeys queue one Send Now per copy today. `commitment-creation-send.test.ts` locks the background mode, so change it deliberately. Measure the bundle: 10 per group is untested against the 5-item placeholder for a UserOperation. Update the `SeedFlowFooter` copy.
- [ ] **7.2 Make Edit Reward work on passkeys.** The refusal is a gap, not a rule: the contract checks only the pool steward, admin offers passkeys, and the dialog promises a prompt before every copy comes back refused. One-by-one sends can ship first; 50 calls per group is unmeasured.

**Phase exit:** AC-25 passes, and no copy is sent twice after a reload.

### Phase 8: Karma and marketplace approvals

**PR 8.** Depends on slice 2.

- [ ] **8.1 Batch Karma reconcile.** `reconcileProject` and each `reconcileProjectAccess` go in bounded groups, because the account count is unbounded. Confirm each account from `KarmaSyncRecorded`, which the app's ABI lacks: a successful transaction can still record a failure. This retires the last caller of `sendBatch`.
- [ ] **8.2 Batch marketplace approvals.** `grantApprovals` and `setApprovalForAll` go together, and the pending store records both, where it records one step today. These grant transfer rights, so confirm with the approval reads.

**Phase exit:** AC-26 passes for both actions.

### Phase 9: campaign jar sync

**PR 9.** Depends on slice 2. Alone, because it changes who can withdraw.

- [ ] **9.1 Batch the sync.** Grant, revoke, and metadata go together in `useCampaignCookieJar.ts`. Merge its two hooks, move off the deprecated sender, and confirm with `getAllowlist` and `getMetadata`. A failed group must leave the old allowlist in place.

**Phase exit:** AC-26 passes, and the panel never shows a change the chain does not hold.

### Phase 10: action edit

**PR 10.** Depends on slice 2.

- [ ] **10.1 Batch the edit.** Title, start, end, and instructions go together in `useActionEditorController.ts`. The instructions upload runs after the writes today, so move it first. Moving a window later appears to revert today when the start goes first (inferred), so order the group and prove it. Bring the controller's own recovery in line with the journal.

**Phase exit:** AC-26 passes, including a window moved later.

### Phase 11: Octant checkout

**PR 11.** Depends on slice 4. Wallets only, on mainnet.

- [ ] **11.1 Batch the checkout on atomic wallets.** WETH wrap, reset, approval, and vault deposit go together, reusing Phase 4's outcome rules. Plain wallets keep today's steps, and passkeys stay refused.

**Phase exit:** AC-27 passes.

### Phase 12: add and send proof

**PR 12.** Depends on slice 7. Blocked until the user reverses a recorded decision.

- [ ] **12.1 Decide, then batch.** `useCommitmentJobs.ts` records "two calls, two signatures" for this flow, so a proof is kept even when its send fails. Batching means the queue carries both as one job: the second job waits for the proof today, its solo simulation reverts `EvidenceRequired`, and the client's passkey send is a flush, not a tap.

**Phase exit:** AC-27 passes, and a proof still survives a failed send.

## Will not batch

| Action | Why |
|---|---|
| Voucher deposit | One explicit member approval per call by design, on a codeless wallet |
| Issuer allow, enable, exchange | Each is its own review, and enable reads the landed allowance |
| Reward agreement and take-up | The claim's prechecks read the landed agreement |
| Take-up and work | The link needs the work's UID from an indexed receipt |
| Harvest and split | The split depends on the harvest receipt and a later read |
| Hypercert mint and register | Registering needs the ID from the mint receipt |
| Listing | The order signature is itself an argument |
| Queue flush | Unrelated acts with no reviewed group |
| Card endowment | thirdweb already batches it, outside the sender |
| Payout walk | Separate acts on different chains |

## Repository and delivery constraints

- Hooks remain in Shared; domain rules stay with garden/work; public imports use declared exports. Do not enlarge source-structure debt baselines.
- New strings cover en/es/pt and use the owning design/brand guidance. No technical batching jargon in routine product copy.
- No dependency installation, root-env change, contract deployment, branch change, external publication, or unrelated repair is implied.
- Any contract/profile incompatibility, concurrency-rule change, or broader client UX requirement returns as explicit new scope.
- Keep implementation status and TDD pending until the corresponding work and fresh receipts exist. Use [eval.md](eval.md) and lane handoffs for proof; documentation validation is not runtime proof.
