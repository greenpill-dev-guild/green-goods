# Codex session prompt: Commitment Credit contract increment

Date: 2026-08-08. **Revised 2026-08-09** — the gates this prompt used to wait on have cleared, and
the interfaces it builds against moved. Read the activation gate before anything else.

## Activation gate

This is stage 2 of 3. It owns the credit-contract increment only: not the pooling PR, not the
downstream indexer/shared/UI work, not deployment tooling, live configuration, or broadcast.

**The three preconditions are met as of 2026-08-09.** Verify each rather than trusting this list.

1. **Stage 1 is merged.** greenpill-dev-guild/green-goods#694 merged to `develop` as merge commit
   `c60b38dea`, carrying the pooling module, the payer/recipient correction, the settlement module
   and Celo executor, and the schema recovery lane.
2. **The human legal/operations review is cleared.** Afo signed off the interest-free,
   records-only lending posture on 2026-08-09; `.plans/active/commitment-credit-follow-on/status.json`
   records it. That was dispatch gate 3.
3. **The branch already exists.** Work on `feature/build-commitment-crediting-contracts`, branched
   from `c60b38dea`. Do not create another branch, and do not use the older
   `codex/contracts/commitment-credit-follow-on` name from the Plan Hub signal.

What remains open is gate 2, and it is your first task: **spec revalidation against the interfaces
as built**. Three decisions landed on this branch after stage 1 merged and they change the
settlement surface you build against — see "Interface as built" below. `spec.md` predates them.

Repository:

```text
/Users/afo/Code/greenpill/green-goods
```

Before changing files:

1. Read the root `AGENTS.md`, `packages/contracts/AGENTS.md`,
   `.plans/active/commitment-credit-follow-on/{brief.md,spec.md,plan.todo.md,status.json,eval.md}`,
   its `handoffs/codex-contracts.md`, and the implemented pooling/settlement interfaces.
2. Pin the actual merge base and HEAD from Git. Do not rely on this dated prompt for live state.
3. Inspect `git status`, recent commits, and current worktrees. This repository runs concurrent
   agents: preserve unrelated work, never reset or revert it, and surface anything unexpected
   rather than fixing it.
4. Read `.plans/active/commitment-pooling/reports/pre-merge-review-2026-08-09.md`. It records
   verified open defects in the settlement contracts and the indexer read model. You are not fixing
   them, but you must not build on top of one and you must not re-report them as new.
5. Run the Plan Hub Linear preview before implementation:

   ```bash
   node scripts/harness/plan-hub.mjs linear-sync --feature commitment-credit-follow-on --json
   ```

   The known records are parent PRD-697 and contracts lane PRD-785. Query live Linear before
   writing; `.plans` remains execution truth. When you do write to Linear, follow the house style
   in `AGENTS.md` — plain sentences for a teammate opening the issue cold, no spec citations, no
   decision numbers, no pasted agent output.

If any precondition fails to verify, stop and report the blocker. Do not implement around it.

## Interface as built (2026-08-09)

Three decisions landed after stage 1 merged. They are the reason gate 2 is still open, and each one
touches something the credit seam sits next to. Read the code, not this summary.

**Deployment identity is emitted.** `SettlementModule.initialize` emits
`SettlementDeploymentPinned(ccipRouter, localChainSelector, remoteEvmChainId)`, and the executor
emits `ExecutorDeploymentPinned(ccipRouter, gDollarToken, remoteChainSelector, localChainSelector,
sourceEvmChainId)` — the executor carries `LOCAL_CHAIN_SELECTOR` and `SOURCE_EVM_CHAIN_ID` as
constructor immutables purely so it can state them, since neither is needed to execute a
settlement. These events are the indexer's only source for those fields. If you add an
initialization path, it announces its identity the same way.

**Acknowledgments are checked against the live route.** `SettlementLifecycleLib.canStillAcknowledge`
is the shared predicate: the active peer, or the previous peer inside its unexpired grace window.
A retired executor's acknowledgment reverts `RetiredPeerAcknowledgment`. Its companion is
`failStrandedSubject(bool isBatch, uint256 subjectId)`, owner-only, which closes out a `Dispatched`
subject whose executor can no longer answer and refuses with `SubjectNotStranded` while it still
can. It writes `FailureCode.SourceStranded`, appended last so ordinals 0-11 stay identical to the
executor's enum. **A loan-principal disbursement is a commitment-bound child like any other, so it
inherits both of these.** Your tests must cover a stranded loan disbursement.

**Claiming a priced Offer requires a steward.**
`CommitmentPoolingAcceptanceLib.requirePricedOfferClaimAuthority` gates it, reverting
`PricedOfferClaimRequiresSteward`. This is the pooling side, not yours, but it is the current
precedent for "an institutional act needs institutional authority" — the same question arises for
who may request a loan `onBehalfOf` a pool member.

`DisbursementKind` ordinals as built: `ContributorConsideration` 0, `Funding` 1, `LoanPrincipal` 2,
`GardenBeneficiary` 3. `LoanPrincipal` is still reserved and unqueued — no code path reaches it.

## Mandate

Build and adversarially harden the records-only `CreditRegistry` contract increment, including its
strictly bounded settlement seam, then stop at a merge-ready handoff. Use Bun wrappers only; never
invoke raw Forge. Do not deploy, broadcast, configure a live chain, create a deployment branch, or
merge the PR.

This prompt supersedes the older credit handoff only where that handoff required deployment
plumbing inside the credit-contract PR. The agreed branch boundary is now:

- this stage implements and proves the contracts and their frozen interfaces;
- the separate stage-3 prompt implements every deploy target, artifact/recovery path, courier,
  live configuration, and broadcast ceremony after this PR merges.

Update the active credit Plan Hub and handoff to record that scope correction before marking the
contracts lane unblocked. Do not silently leave `status.json`, `plan.todo.md`, or the handoff
describing a deployment prerequisite that this stage deliberately defers.

## Architecture to preserve

`CreditRegistry` is an Arbitrum records-and-authorization control plane for interest-free
borrow-and-repay activity. It never holds or transfers funds and never creates a personal credit
score.

Value moves only on existing rails:

- Cookie Jar or garden treasury on Arbitrum; or
- the existing Celo G$ settlement rail for a principal disbursement.

The registry records those already-executed movements. Repayment is record-only on Arbitrum. No
bridge, revolving protocol corpus, interest, score, ranking, transferable debt/voucher, or custody
is introduced.

The hard loan states are:

```text
Requested -> Approved -> Disbursed -> Repaid
                              |-----> Defaulted -> Repaid
Requested/Approved ----------> Cancelled
```

`Repaying` is derived when `0 < repaidAmount < principal + feeAmount`; it is never stored as a hard
state. Default is recoverable and remains in history. The MVP is interest-free, so `feeAmount` is
reserved and zero unless the human legal/operations decision explicitly changes the frozen spec.

Authorization remains pool-scoped:

- a pool member requests for self; a steward may use the explicit `onBehalfOf` path;
- a borrower cannot approve their own loan;
- only a steward or registered pool executor records disbursement or repayment;
- pool enablement and the per-borrower cap are hard gates;
- cancellation is allowed from Requested/Approved but never after value is disbursed; and
- pause blocks ordinary mutations while preserving the exact wind-down/default paths frozen in
  the spec.

The pooling module and `CommitmentRegistry` are read-only dependencies here. Do not change their
ABI, storage, lifecycle, events, or accounting. A loan's optional `commitmentId` is a one-way
reference; neither system transitions the other.

## Settlement seam

`ISettlementModule.DisbursementKind.LoanPrincipal` exists and is still reserved: nothing queues it.
The dedicated queue selector and its exact loan relationship do not exist.

The credit contract stage must add one explicit loan-principal queue path whose preflight derives
the approved loan, pool garden, source Safe, borrower recipient, canonical G$, principal, and loan
relationship. It must not reopen the rejected generic `commitmentId == 0` member-disbursement path,
reuse `Funding`, pretend a loan is a payout-plan child, or weaken contributor/beneficiary gates.

The current credit spec describes the behavior but does not freeze the exact selector signature in
the interface. Before implementation, adversarially review and record the exact selector name,
arguments, return, event/error changes, disbursement relationship, and storage/ABI consequences in
the canonical plan. Do not invent an ABI from prose. If that exact freeze requires human judgment,
stop with the smallest concrete decision request.

G$ repayment is a separate asymmetry: there is no upward disbursement primitive. A human-entered
transaction hash alone cannot authenticate repayment, and Chainlink Functions is retired. Unless
the interface revalidation plus legal/operations review freezes a bounded authenticated receipt
policy, keep G$ repayment disabled. Jar/Treasury borrow-and-repay is the executable baseline.

## Built-versus-missing boundary at the dated snapshot

Verify this against the merged base before relying on it:

- built: pooling and settlement foundations, including the `LoanPrincipal` enum ordinal, plus the
  three 2026-08-09 decisions above;
- not built: `ICreditRegistry`, `CreditRegistry`, its storage baseline and behavior tests, and the
  dedicated settlement loan-principal queue selector;
- deliberately not part of this stage: deploy scripts, deployment artifacts, live addresses,
  indexer/shared/UI implementation, Safe/Role configuration, courier operation, and broadcast.

**Known-open and not yours to fix.** The pre-merge review found real defects that are still open,
all pre-deploy. In the settlement contracts: the Arbitrum account registry does not enforce the 1:1
Safe-to-garden mapping the Celo side does, registration is write-once at steward tier with no owner
correction path, and a batch can be griefed into failure by one hostile recipient through a G$
receive hook. In the indexer: every settlement-to-`Garden` join key is written lowercase while
`Garden.id` is checksummed, `contributorEntityId` is a bare address against a composite
`Gardener.id`, and several update handlers bail before writing subject state so reverse-delivered
events never reconcile. Do not build a credit path that depends on any of these being correct, do
not fix them here, and do not re-report them as new findings.

Nothing is deployed. No settlement address is registered in `packages/indexer/config.yaml`, and no
deploy target exists for either settlement contract — that is stage 3.

Do not call the credit lane complete merely because the contracts PR becomes merge-ready. This
stage completes only the contracts increment.

## Required work

Execute in dependency order with RED/GREEN evidence:

1. **Close gate 2 first: revalidate `spec.md` against the interfaces as built.** This is not a
   formality — `spec.md` predates the three 2026-08-09 decisions, and stage 1 itself renamed the
   promise-side `Reward*` vocabulary to `Consideration*` and added `payerGarden`, so any spec
   sentence naming a settlement type, event, or authority is suspect until you have opened the
   code. Record what moved, then reconcile the Plan Hub dispatch gate: gate 3 (legal/operations)
   is cleared and gate 1 (stage-1 merge) is met, so only the deployment-plumbing prerequisite is
   removed. Do not leave `status.json`, `plan.todo.md`, or the handoff describing a gate that no
   longer exists.
2. Produce a selector/requirement coverage ledger for the exact credit ABI, permissions, state
   transitions, storage, events, errors, settlement seam, and upgrade surface.
3. Record failing focused tests before production implementation. No behavior-changing lane may be
   marked passed without honest RED/GREEN evidence in the handoff and `status.json`.
4. Add the consumer-driven `ICreditRegistry` interface and UUPS `CreditRegistry` implementation
   using established repository patterns, explicit visibility, bounded iteration, CEI, custom
   errors, non-reentrancy where external calls exist, and exact 50-slot accounting.
5. Implement and test pool configuration, executor management, request, approval, disbursement
   recording, installment repayment, recovered default, cancellation, cap accounting, commitment
   uniqueness, pause/wind-down behavior, dependency setters, views, and upgrade authorization.
6. Add the exact frozen `LoanPrincipal` queue seam to settlement in the smallest library-weighted
   form. Preserve existing enum ordinals, storage compatibility, payer/recipient rules, retry and
   acknowledgment semantics, execution-key isolation, and EIP-170 margin.
7. Add storage-layout baselines, upgrade-from-old-layout proof, unit/adversarial/fuzz/invariant
   coverage, and a read-only fork test for a Jar/Treasury round trip where the repository has a
   deterministic existing rail fixture. Do not create a live transaction.
8. Run the exact gates below, conduct a final adversarial review of the committed range, resolve all
   Critical/High findings in scope, update the Plan Hub/handoff with fresh proof, and stop for human
   review and merge.

## Minimum adversarial cases

- self-approval and steward-on-behalf confusion;
- cap checked at request but exceeded at approval/disbursement through intervening loans;
- duplicate loan for one commitment and stale link cleanup after cancellation;
- partial repayment arithmetic, overpayment, zero repayment, multiple installments, default then
  recovery, and outstanding-balance conservation;
- cancellation after disbursement and repayment against an unexecuted or mismatched rail;
- forged executor, executor removal, dependency replacement, pause exceptions, reentrancy, and
  replayed `executionRef`;
- zero/invalid pool, borrower, token, amount, due date, terms, and settlement identity;
- `LoanPrincipal` accidentally accepted through generic contributor/funding gates;
- loan relationship lost across dispatch, retry, acknowledgment, cancellation, or upgrade;
- a dispatched loan principal stranded by executor retirement: `failStrandedSubject` must reach it,
  the loan must not read as disbursed on the back of a source-side failure, and a requeue after
  close-out must not double-count or double-pay; and
- storage/ABI/event ordinal drift and EIP-170 regression.

## Scope boundaries

- Contracts only: do not implement indexer entities, shared types/hooks, admin/client UI, or agent
  jobs in this PR.
- Do not add deploy targets, `DeploymentResult` wiring, artifact persistence, Safe/Zodiac setup,
  courier scripts, live network configuration, or post-deploy commands here.
- Do not deploy, broadcast, transfer authority, send value, or mutate Linear without re-reading
  live state and the authorization expected by the Plan Hub workflow.
- Never add custody, interest, a credit score, a leaderboard, transferable debt, an arbitrary
  execution surface, or human-only confirmation of Celo repayment.
- Use root environment conventions only. Do not install dependencies or add package-level env
  files.
- Put selector weight in libraries when necessary; do not solve size pressure with an oversized
  module shell.

## Exact validation

Use the lightest focused loop while implementing, then run the full contracts ship evidence before
requesting review:

```bash
cd packages/contracts && bun run test
cd packages/contracts && bun run build:full
cd packages/contracts && bun run check:sizes
cd packages/contracts && bun run check:storage-layout
cd packages/contracts && bun run lint
cd packages/contracts && bun run test:audit:full
cd packages/contracts && bun run test:fork:settlement-lane
node scripts/quality/check-source-structure.js --base <fresh-merged-base>
bun run check:ontology
bun run format:check
git diff --check <fresh-merged-base>
```

Add and run an exact Bun `test:match` target for the new credit test file after confirming the
repository wrapper syntax. Never invoke Forge directly and never invent an environment value. If
cross-package artifacts legitimately change despite the contracts-only boundary, run:

```bash
node scripts/dev/ci-local.js --quick
```

Four things about this loop that cost time if you learn them the hard way:

- `bun run test` in `packages/contracts` now chains typecheck, the Solidity suite, and the script
  tests. `bun run test:solidity` is the Solidity-only loop while iterating.
- `bun run build` is the adaptive compile. `bun build` is Bun's own bundler and will fail with
  "Missing entrypoints" — the two are not the same command.
- Any new `vm.mockCall` or `vm.store` needs an entry in `test/audit/mock-allowlist.json` with a
  reason, owner, and expiry, or `test:audit:realism` fails the build. Prefer a real fixture; if the
  mock is genuinely necessary, say why in the entry.
- The Arbitrum fork rehearsal needs three reviewed pins that are environment prerequisites, not
  test data. Verified against live Arbitrum on 2026-08-09 and passing:
  `HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER=492603739`, `HATS_MODULE_UPGRADE_GARDEN_COUNT=18`,
  `HATS_MODULE_UPGRADE_EXPECTED_IMPLEMENTATION=0xE5E5CbEDa7dC1139aF2e04bd4A6784b42b4bEcd2`. Re-derive
  them rather than reusing these if the chain has moved; the count assertion is exact, so it fails
  the moment a nineteenth garden mints.

## Completion contract

Return a merge-ready handoff only when:

- the Plan Hub dispatch gates and scoped settlement ABI are coherent and recorded;
- RED/GREEN proof, storage/upgrade proof, size proof, measured coverage, full tests, and final
  adversarial review are fresh and green;
- no unresolved Critical/High finding remains in the credit-contract or settlement-seam scope;
- the pooling ABI/lifecycle remains unchanged; and
- no deployment, broadcast, live configuration, indexer activation, or value movement occurred.

Report exact commits, changed files, test counts, size margins, coverage, known lower-severity debt,
and the explicitly deferred deployment/release work. Do not merge the PR yourself.
