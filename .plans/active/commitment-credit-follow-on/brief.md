# Commitment Credit — August Companion

**Slug**: `commitment-credit-follow-on`
**Stage**: `active — contracts increment in progress (stage 2 of 3)`
**Priority**: `p1`

## Outcome

Add a records-only, interest-free borrow-and-repay register against the merged Commitment Pooling and settlement interfaces. The module records loan state and authenticated or steward-attested payment-rail references; it never custodies or transfers funds and never creates a personal credit score.

## Activation boundary

The explicit scope unlock was granted 2026-08-01 (pooling plan register #73, Grassroots Economics review session). The three contracts dispatch gates cleared on 2026-08-09: stage 1 merged at `c60b38dea`, Afo approved the interest-free records-only legal/operations posture, and the revalidation in [spec.md](spec.md) froze the exact `LoanPrincipal` selector against the interfaces at branch HEAD `238e4e218`. This stage owns the contract implementation and proof only. Deployment targets, artifacts, recovery/courier paths, live configuration, and broadcast are stage 3 after this contracts increment merges.

The detailed design is in [spec.md](spec.md).
