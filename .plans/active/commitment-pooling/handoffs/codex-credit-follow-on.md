# Commitment Pooling - Codex Credit Follow-On Handoff

## Status

- Follow-on lane: `credit_register`
- Owner: Codex
- Branch: `codex/credit/commitment-pooling`
- Current state: blocked follow-on; not part of August base MVP

## Blocker

- Requires explicit scope unlock after pooling and settlement interfaces settle.

## Scope When Unblocked

- `CreditRegister`, credit indexer/shared surfaces, `queryKeys.credit.*`, credit job kind, and admin/PWA credit surfaces from `credit-spec.md`.

## Out Of Scope Until Unblocked

- Any borrow-and-repay implementation, credit-score UX, repayment settlement semantics, or Linear tracker expansion for this lane.
