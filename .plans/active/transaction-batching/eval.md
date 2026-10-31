# Transaction Batching and Recovery Evaluation

**Current state:** `develop` at `974b69ac9` was merged into the Phase 1 checkpoint on 2026-10-30. [The continuation handoff](handoffs/continuation.md) records the focused results on that merge, and the PR records the gate and CI results for its final head. Settings, member batching, deposits, and the bulk review UI are not implemented. Earlier handoffs and artifacts describe earlier bases and remain historical.

## Acceptance matrix

| ID | Boundary | Required behavior | Owner |
|---|---|---|---|
| AC-01 | Preparation/capability | Reject empty/mixed-scope groups; scope capability to account/chain; no upgrade for `ready`; single-call compatibility remains | state_api |
| AC-02 | Checkpoint ordering | Persist intent before signer and accepted reference before waiting; storage failure before send prevents broadcast | state_api |
| AC-03 | Ambiguous execution | Timeout/disconnect/crash/status expiry stays unresolved; no fallback, automatic split, or resend | state_api |
| AC-04 | Recovery/concurrency | Reload resumes reads; double-click/tabs share claims; account changes stop sends without deleting references; expired claims do not authorize resend | state_api |
| AC-05 | Passkey execution | Both supported Kernel profiles preserve address; inner failure cannot be mistaken for success; all-or-nothing batch mode is verified | state_api |
| AC-06 | Wallet execution | Opaque IDs, additional-signature proposals, multiple receipts, partial protocol outcomes, and replacement/cancel cases retain truthful states | state_api |
| AC-07 | Limits/fallback | Ordered simulation and budgets precede consent; rejection stops later groups; unsupported-wallet sequential mode is explicit; no silent payer change | state_api |
| AC-08 | Work queue | Individual jobs/claims and dependency order survive batching; no conflict between journal and queue recovery | state_api |
| AC-09 | Settings | Only changed fields send; banner upload finishes first; supported batch reverts together; actual values determine saved outcomes | ui/state_api |
| AC-10 | Settings recovery | Draft survives rejection/reload; confirmed fields are not retried; Safe proposal stays pending; ordinary wallet progress survives interruption | ui/state_api |
| AC-11 | Member preparation | ENS resolves before consent; duplicate roles collapse; existing roles are no-ops; invalid/unauthorized rows cannot silently send | ui/state_api |
| AC-12 | Member recovery | Earlier groups stay complete after later failure; retry contains only unsent/definitely failed rows after revalidation | ui/state_api |
| AC-13 | Individual review | Approvals need chosen confidence; rejections need reasons; no unseen work, self-review, expired action, mixed garden/chain, or stale unacknowledged decision | ui/state_api |
| AC-14 | Native multi-attestation | Passkey and ordinary wallet submit one EAS call per group; one resolver revert fails the group; every expected UID maps to its item | state_api |
| AC-15 | Review metadata/status | Preserve feedback, confidence, verification method, review-notes CID and identifiers; timeout never clears pending or emits completion | state_api |
| AC-16 | Approval recovery | Mixed decisions and delayed/out-of-order reads reconcile correctly; admin recovery never becomes auto-send offline work; latest-decision race is documented | state_api |
| AC-17 | Interaction/accessibility | Keyboard selection, explicit scope/counts, focus recovery, localized states, and non-color-only outcomes work in existing responsive layouts | ui |
| AC-18 | Compatibility | Single reviews, client Upload all/offline flow, pool creation/setup/reward editing, and embedded sender retain their supported behavior | qa_pass_2 |
| AC-19 | Rollout/measurement | Evidence identifies enabled account/chain combinations; per-rail requests and latency are compared; disabling new batches leaves recovery available | qa_pass_1/qa_pass_2 |
| AC-20 | Deposit group | The group holds only the calls needed, for the exact amount; the reset appears only when the allowance is nonzero and too low; passkeys and atomic wallets use one request; plain wallets keep two visible signatures | state_api |
| AC-21 | Deposit outcome | Only a matching `Deposit` event confirms; a reverted atomic group leaves no allowance; an unknown outcome stays pending across a reload and holds the next deposit into that vault or jar; a confirmed deposit holds nothing | state_api |
| AC-22 | Deposit interaction | The signature count is stated up front and matches what the wallet asks for; each signature is shown landing; an unknown outcome never reads as failed; client and admin surfaces agree in en, es, and pt | ui |
| AC-23 | Held operations | A closed signing prompt never holds items for good: a passkey record with no reference reopens after reload, a wallet record needs a fresh domain read and the user's confirmation, and a group with a reference is never released; a reference that arrives after a lapsed lease is still saved | state_api |

## Proof strategy

Use direct domain tests, real-adapter conformance tests, consumer wiring tests, and production-composition proof separately. Mock external RPC at the boundary, not the batch module under test. Exercise crash points before send, after signer return, after broadcast, before reference storage, while waiting, and between groups. Include IndexedDB reopen/upgrade/failure and two-tab claim behavior.

Contract-native atomicity needs a faithful EAS/resolver integration or authorized local-chain/fork proof using repository Bun wrappers. A mock whose `multiAttest` is unimplemented cannot establish the claim. No new production contract is planned. If existing fixtures cannot prove the behavior, record the gap and choose a bounded integration fixture before enabling bulk approval.

The live matrix includes legacy Kernel 0.3.1 and pilot 0.3.3 only on their allowed chains, deployed and undeployed accounts where supported, an atomic-capable wallet, an ordinary unsupported wallet, and the existing Safe/proposal path where available. Record wallet/version, chain, account profile, sponsorship behavior, submission count, result, and recovery evidence. Unsupported or untested combinations remain explicitly unproven; do not infer support from a mocked receipt.

For UI, use labeled Storybook/mock-auth localhost/CI Playwright proof for layout and selection. Wallet/passkey signing, session, job queue, and offline paths require authenticated-class proof through the user's existing authenticated browser path. Record the actual engine/session class and date. Browser proof is advisory for ordinary local/push gates under repository policy; if unavailable, keep it pending, do not substitute an isolated profile, and do not claim that combination is verified. Release attestation follows the release gate exactly.

## Commands and stopping rules

At each implementation checkpoint, use the current owning package guide and selector; the following are initial candidates, not completed receipts:

```sh
bun run check --plan -- --intent qa --changed <comma-separated-paths> --test-path <surface>:<test-path>
```

Known existing Shared tests for Phase 1, run from `packages/shared`:

```sh
bun run test -- src/modules/transactions/__tests__/passkey-sender.test.ts src/modules/transactions/__tests__/wallet-sender.test.ts src/__tests__/modules/work/upload-queued-work.test.ts
```

Add the new journal/conformance tests and affected commitment, settings, members, approval, and UI tests as each checkpoint introduces behavior. Do not run the entire suite repeatedly for documentation or unchanged code. Run selector-required type, format, lint, source-structure, and cross-package checks with full critical overrides. Use checkpoint/push/release intents only when the corresponding action is authorized. A push or release needs the user's current instruction.

For a terminal implementation lane, record RED/GREEN with `plan-hub.mjs record-tdd`, then a fresh receipt containing tested full SHA, UTC timestamp, exact command/result, validated paths, and empty path-scoped worktree status. Follow the repository's evidence-only continuation rules. Never attribute uncommitted code to HEAD or recycle the earlier review's tests as implementation proof.

## Measurement and rollout

Capture per feature and authentication rail: selection size, submitted groups, application signer requests, confirmed/failed/unresolved item counts, recovery attempts, time to first request, and time to verified completion. Compare the same representative operations before and after, with median/tail latency when a meaningful sample exists. Do not log member addresses, decision text, media, or raw calldata in product analytics.

Expected interaction targets: one application request for settings within a supported budget; one per member group for supported accounts; one per deposit for passkeys and atomic wallets; one per EAS approval group for both rails. Ordinary wallets retain sequential settings, member, and deposit requests. These are conditional product targets, not measured results or universal single-signature guarantees.

Enable phases in order with existing rollout controls. Any confirmed duplicate resubmission, false completion, metadata loss, or account/chain crossover blocks further enablement until fixed. Disable new batch submissions independently from journal reads and recovery. Pending operations retain their original transport and identity after a rollback.

## QA sequence and present evidence

1. QA pass 1 checks requirements, usability, accessibility, and measured interaction counts.
2. QA pass 2 follows pass 1 and checks critical recovery, compatibility, conformance, and fresh validation evidence.
3. Both record gaps explicitly; neither may complete from plan validation alone.

The preceding review ran three targeted Shared files with 91 passing tests at the inspected baseline. That historical observation establishes existing behavior only. The foundation snapshot passed 51 focused tests and its package suites, as recorded in [handoffs/phase-1.md](handoffs/phase-1.md). Those results are historical after budget enforcement changed runtime source. The prior limits snapshot is recorded in [handoffs/phase-1-compatibility.md](handoffs/phase-1-compatibility.md); the [planning record](handoffs/planning.md) also remains historical. That original snapshot passed 180 focused tests with six existing skips. The develop-based publication checkpoint passed 203 focused tests with six existing skips; [publication.md](handoffs/publication.md) and its receipt own current proof. Eight software-signed Kernel fork execution outcomes and a real MetaMask message signature passed. Configured paymaster acceptance and positive atomic-wallet execution remain open. Current full-gate results must be read from the publication record and PR, not inferred from the historical failure. Further device/account/profile QA belongs to its owning session; standalone probes from this lane were stopped after the user clarified the overlap.
