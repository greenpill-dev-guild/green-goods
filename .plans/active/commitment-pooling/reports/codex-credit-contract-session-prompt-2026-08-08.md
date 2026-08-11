# Codex session prompt: Commitment Credit contract increment

Date: 2026-08-08

## Activation gate

Use this prompt only after a human confirms that the payer/recipient/settlement implementation PR
has merged into the target base. This is stage 2 of 3. It owns the credit-contract increment only.
It does not own the earlier pooling PR, downstream indexer/shared/UI work, deployment tooling, live
configuration, or broadcast.

Repository:

```text
/Users/afo/Code/greenpill/green-goods
```

Before changing files:

1. Read the root `AGENTS.md`, `packages/contracts/AGENTS.md`,
   `.plans/active/commitment-credit-follow-on/{brief.md,spec.md,plan.todo.md,status.json,eval.md}`,
   its `handoffs/codex-contracts.md`, and the implemented pooling/settlement interfaces.
2. Fetch or otherwise refresh the named target branch, confirm the stage-1 PR is actually merged,
   and pin the new merge base and HEAD. Do not rely on this dated prompt for live Git state.
3. Inspect `git status`, recent commits, current worktrees, and file ownership. Preserve unrelated
   concurrent work; never reset or revert it.
4. Create or switch to the fresh credit-contract branch only when the human launching this prompt
   explicitly authorizes that branch action. The current Plan Hub branch signal is
   `codex/contracts/commitment-credit-follow-on`; re-read it rather than treating the name as
   permanent.
5. Run the Plan Hub Linear preview before implementation:

   ```bash
   node scripts/harness/plan-hub.mjs linear-sync --feature commitment-credit-follow-on --json
   ```

   The known records at this dated snapshot are parent PRD-697 and contracts lane PRD-785. Query
   live Linear before writing; `.plans` remains execution truth.

If the stage-1 merge, clean branch base, or human legal/operations gate cannot be proven, stop and
report the blocker. Do not implement around it.

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

`ISettlementModule.DisbursementKind.LoanPrincipal` already exists at the 2026-08-08 implementation
snapshot. The dedicated queue selector and its exact loan relationship do not.

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

- built: pooling and settlement foundations, including the `LoanPrincipal` enum ordinal;
- not built: `ICreditRegistry`, `CreditRegistry`, its storage baseline and behavior tests, and the
  dedicated settlement loan-principal queue selector;
- deliberately not part of this stage: deploy scripts, deployment artifacts, live addresses,
  indexer/shared/UI implementation, Safe/Role configuration, courier operation, and broadcast.

Do not call the credit lane complete merely because the contracts PR becomes merge-ready. This
stage completes only the contracts increment.

## Required work

Execute in dependency order with RED/GREEN evidence:

1. Reconcile the Plan Hub dispatch gate with the three-stage branch decision. Preserve the merged
   pooling foundation requirement, revalidate every spec-cited interface/path, and record the
   completed human legal/operations review. Remove only the requirement that final deployment
   plumbing already exist before credit implementation.
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
- loan relationship lost across dispatch, retry, acknowledgment, cancellation, or upgrade; and
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
