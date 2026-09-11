# Commitment Credit — August Companion - Claude QA Pass 1 Handoff

## Status

- Machine lane: qa_pass_1
- Owner: Claude
- Branch signal: claude/qa-pass-1/commitment-credit-follow-on
- Current state: blocked on contracts, state_api, and ui GREEN

## Inputs

- Final contracts, indexer, shared, and UI handoffs with RED/GREEN evidence.
- Updated `../status.json`, revalidated `../spec.md`, and authenticated Brave access.
- Human legal/operations review record for the interest-free, records-only posture.

## Outputs

- First independent role/state/journey QA record covering contract-to-indexer-to-shared-to-app boundaries.
- Defect list routed to the owning lane; QA does not implement fixes.
- Explicit external proof limits for live rail, Safe, wallet, or browser dependencies.

## Acceptance

- Request, approval, loan-principal queue, disbursement record, installment repayment, default, recovery, cancellation, and cap paths match the spec.
- Loan and reward status remain separate; no lifecycle coupling reaches Commitment Pooling.
- Steward, self, unauthorized viewer, and editorial aggregate visibility are exercised.
- No custody, bridge, score, ranking, leaderboard, public borrower row, transferable voucher, or in-kind valuation claim appears.
- Authenticated Brave covers the admin and member flows; every loading/offline/pending/failure/recovery state has an exit.

## RED / GREEN or proof limit

- RED: any acceptance path, focused command, or rendered role/state fixture disagrees with the frozen spec.
- GREEN: all focused lane commands pass and every defect is fixed/re-proven or explicitly accepted.
- Proof limit: unavailable live rails or authenticated sessions remain blockers; isolated browser proof cannot replace them.

## Exact Bun commands

- `bun run --filter @green-goods/contracts test:match -- test/unit/CreditRegistry.t.sol`
- `bun run --filter @green-goods/indexer test -- test/creditRegistry.test.ts`
- `bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts`
- `bun run --filter @green-goods/shared typecheck`
- `bun run --filter @green-goods/client test`
- `bun run --filter @green-goods/admin test`
- `bun run lint:vocab`
- `bun run agentic:check`

## Out of scope

- Fixing defects inside QA, broadcasts, transferable vouchers, public participant comparisons, manual settlement confirmation, or weakening an unavailable proof gate.

## Unblock evidence

- Contracts, state_api, and ui lanes are GREEN with current handoffs.
- Authenticated Brave access and any required real-wallet path are confirmed.
- `status.json` dependency state agrees with the final implementation artifacts.
