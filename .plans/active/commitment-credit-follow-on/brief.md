# Commitment Credit — August Companion

**Slug**: `commitment-credit-follow-on`
**Stage**: `active — August-wave companion chain`
**Priority**: `p1`

## Outcome

Add a records-only, interest-free borrow-and-repay register once the Commitment Pooling and settlement interfaces freeze in code. The module records loan state and existing payment-rail references; it never custodies or transfers funds and never creates a personal credit score.

## Activation boundary

The explicit scope unlock was granted 2026-08-01 (pooling plan register #73, Grassroots Economics review session): this chain builds in the same August wave as Commitment Pooling, as an additive companion with zero pooling-module/register changes. Three dispatch gates remain before the contracts lane starts, recorded in [status.json](status.json): the in-code pooling/settlement interface freeze, revalidation of every spec-cited path against the implemented interfaces, and the human-owned legal/operations review of the interest-free records-only lending posture (start it immediately — it runs in parallel with the pooling build). The G$ leg locks settlement seam (a), `DisbursementKind.LoanPrincipal`.

The detailed design is in [spec.md](spec.md).
