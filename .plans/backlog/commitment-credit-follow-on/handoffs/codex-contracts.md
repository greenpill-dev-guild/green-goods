# Commitment Credit Follow-on - Codex Contracts Handoff

## Status

- Feature: commitment-credit-follow-on
- Owner: Codex
- Branch signal: codex/contracts/commitment-credit-follow-on
- Current state: manually blocked; not part of the August base MVP
- Linear context: no executable Linear child under parent_only mode

## Inputs

Only after explicit user scope unlock:

- ../spec.md revalidated against shipped pooling and settlement interfaces
- Written pilot evidence that a credit register is needed
- Frozen indexer/shared/API integration contract
- New accepted tracker or explicit parent scope amendment

## Outputs

When unblocked only:

- CreditRegister contracts, tests, indexer entities/handlers, shared queryKeys.credit APIs/jobs, and bounded admin/PWA surfaces.
- Updated handoff with exact evidence-gated behavior and deployment path.

## Acceptance

- No transferable voucher, score, ranking, or debt behavior is inferred from commitment or settlement records.
- Borrow/repay authorization, caps, failure/recovery, privacy, indexer, shared, and UI contracts are explicit before implementation.
- The follow-on remains isolated from base Commitment Pooling and settlement completion.

## RED / GREEN

No RED run is authorized while blocked. After explicit unlock, record a failing CreditRegister test before implementation and pass that same test before integration.

## Exact Bun commands

Do not run until scope is explicitly unlocked:

- bun run --filter @green-goods/contracts test:match -- test/unit/CreditRegister.t.sol
- bun run --filter @green-goods/indexer test -- test/creditRegister.test.ts
- bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts
- bun run --filter @green-goods/contracts build:full
- bun run --filter @green-goods/indexer build
- bun run --filter @green-goods/shared typecheck

## Out of scope

- Any credit implementation before unlock, credit scores, leaderboards, transferable settlement vouchers, arbitrary borrowing, implicit repayment settlement, or issue proliferation.

## Unblock evidence

- Explicit user scope lock names this follow-on.
- Pilot evidence and owner/date are recorded.
- Pooling/settlement interfaces are shipped and revalidated.
- status.json manual blocker is cleared and the new RED target is recorded before code changes.
