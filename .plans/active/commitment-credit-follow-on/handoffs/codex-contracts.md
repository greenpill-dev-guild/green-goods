# Commitment Credit — August Companion - Codex Contracts Handoff

## Status

- Feature: commitment-credit-follow-on
- Owner: Codex
- Branch signal: codex/contracts/commitment-credit-follow-on
- Current state: active August-wave companion lane; contracts dispatch is manually blocked on the three gates below
- Linear context: PRD-697 is the Todo tracker for this lane

## Inputs

The 2026-08-01 scope lock is already granted. Before contracts dispatch, require all three remaining gates:

- Pooling and settlement ABIs, events, permissions, and deployment paths frozen in code (pooling PR chains 2 and 2.5 merged).
- ../spec.md revalidated against those implemented interfaces and current repository paths.
- Human-owned legal and operations review of the interest-free, records-only lending posture completed.

Also require the frozen indexer/shared/API integration contract and the settlement-side
`DisbursementKind.LoanPrincipal` queue shape from the locked seam (a).

## Outputs

After the three dispatch gates clear:

- `CreditRegistry` interface, implementation, storage-layout baseline, unit/fork tests, deployment plumbing, and configuration dry-run.
- Settlement-side loan-principal queue function and tests without weakening the existing reward or funding gates.
- Updated handoff with exact RED/GREEN evidence and the non-broadcast deployment path.

## Acceptance

- No transferable voucher, score, ranking, or debt behavior is inferred from commitment or settlement records.
- Borrow/repay authorization, caps, failure/recovery, privacy, indexer, shared, and UI contracts are explicit before implementation.
- The companion chain remains additive: no pooling-module/register ABI or lifecycle change.
- `DisbursementKind.LoanPrincipal` is the only settlement seam; `commitmentId == 0` never becomes a generic member-disbursement bypass.

## RED / GREEN

No RED run is authorized until all three dispatch gates clear. At dispatch, record a failing
`CreditRegistry` test before implementation and pass that same test before integration.

## Exact Bun commands

Do not run until the three dispatch gates clear:

- bun run --filter @green-goods/contracts test:match -- test/unit/CreditRegistry.t.sol
- bun run --filter @green-goods/indexer test -- test/creditRegistry.test.ts
- bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts
- bun run --filter @green-goods/contracts build:full
- bun run --filter @green-goods/indexer build
- bun run --filter @green-goods/shared typecheck

## Out of scope

- Any credit implementation before the dispatch gates clear, credit scores, leaderboards, transferable settlement vouchers, arbitrary borrowing, implicit repayment settlement, pooling lifecycle coupling, or issue proliferation.

## Unblock evidence

- The granted 2026-08-01 scope lock remains recorded in pooling Decision Log #39/register #73.
- Pooling/settlement interfaces are frozen in code and spec paths are revalidated.
- Human legal/operations review is recorded.
- `status.json`'s manual blocker is cleared and the RED target is recorded before code changes.
