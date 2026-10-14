# Commitment Credit — August Companion - Codex QA Pass 2 Handoff

## Status

- Machine lane: qa_pass_2
- Owner: Codex
- Branch signal: codex/qa-pass-2/commitment-credit-follow-on
- Branch trigger: claude/qa-pass-1/commitment-credit-follow-on
- Current state: blocked on QA Pass 1 defect disposition

## Inputs

- QA Pass 1 evidence and resolved defect list.
- Final scoped implementation handoffs, `../status.json`, and the revalidated spec.
- Current authenticated-browser and live-rail evidence references.

## Outputs

- Independent regression review of contract, indexer, shared, admin, and client boundaries.
- Re-run evidence for every accepted QA Pass 1 fix and unchanged locked exclusion.
- Final dispatch/status consistency and remaining-blocker report.

## Acceptance

- ABI/event/config/entity/type signatures agree, including `DisbursementKind.LoanPrincipal` and the loan relationship.
- Replay/idempotency, installment arithmetic, default recovery, cap enforcement, and same-token repayment retain coverage.
- Viewer-aware steward/self disclosure and aggregate-only editorial output remain enforced through shared selectors.
- No pooling lifecycle coupling, custody, bridge, score, ranking, public borrower row, transferable voucher, swap execution, or in-kind valuation enters the implementation.
- Browser proof remains authenticated and external blockers are not collapsed into a pass.

## RED / GREEN or proof limit

- RED: any QA Pass 1 defect still reproduces, a boundary signature drifts, or a focused command fails.
- GREEN: accepted fixes are re-proven, exact commands pass, and `status.json` agrees with the artifacts.
- Proof limit: stale or unavailable external evidence is named explicitly; it is never replaced with isolated proof.

## Exact Bun commands

- `bun run --filter @green-goods/contracts test:match -- test/unit/CreditRegistry.t.sol`
- `bun run --filter @green-goods/indexer test -- test/creditRegistry.test.ts`
- `bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts`
- `bun run --filter @green-goods/shared typecheck`
- `bun run --filter @green-goods/client test`
- `bun run --filter @green-goods/admin test`
- `node scripts/dev/ci-local.js --quick`
- `node scripts/harness/plan-hub.mjs validate --feature commitment-credit-follow-on --json`

## Out of scope

- New features, defect implementation inside QA, broadcasts, manual settlement confirmation, public participant comparison, or branch ship/merge claims without the explicit Ship Gate.

## Unblock evidence

- QA Pass 1 is GREEN and every defect is dispositioned.
- Current browser/live-rail proof is available or its limit is explicit.
- Plan-hub validation and status state agree before QA Pass 2 can turn GREEN.
