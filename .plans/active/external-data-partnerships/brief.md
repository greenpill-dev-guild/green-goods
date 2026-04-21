# External Data Partnerships

**Slug**: `external-data-partnerships`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-04-17`

## Problem

Operator approvals today rest entirely on self-reported evidence — photos, notes, and social context. There is no independent signal that a submitted work action corresponds to real change on the ground. Without a verification gate, reputation and yield decisions inherit whatever trust the operator places in each gardener; partner-level evidence (vegetation detection, locale signals) is available but not surfaced inside the approval flow.

## Desired Outcome

- Two partner adapters (**Sylvie** + **locale.network**) live and pulling partner-verified signals against work submissions.
- Green Goods' trusted attester address writes an `ExternalVerification` EAS attestation per partner response, with confidence score + raw-data IPFS CID.
- Admin's `WorkReview` surface renders green / yellow / red partner badges pulled directly from EAS (no re-indexing per `CLAUDE.md` indexer boundary).
- Each partner produces **≥1 attestation per week** in one Season One pilot garden by **2026-06-30**.

## Scope Notes

- In scope:
  - `packages/agent` (or new `packages/partners`) `PartnerAdapter` interface + `sylvie.ts` + `locale.ts` + `attestationWriter.ts` + `partnerPoller.ts` cron + on-submission verification endpoint.
  - `packages/shared/src/hooks/useWorkAttestations.ts` + `modules/partners.ts` (barrel-exported).
  - `packages/admin/src/components/WorkReview/VerificationBadges.tsx`.
  - EAS schema registration for `ExternalVerification`.
- Out of scope:
  - Blocking approvals on partner confidence — badges are advisory in Q2.
  - Additional partners beyond Sylvie + locale.network (Q3 candidates live in `.plans/ideas/`).
  - Indexing EAS attestations into Envio (explicitly forbidden by `CLAUDE.md` indexer boundary — query EAS directly at render time).

## Success Signal

`gh api` / block explorer confirms ≥1 `ExternalVerification` attestation per partner per week in the pilot garden for a 2-week sliding window, and operators report the badge actually informed at least one approve / reject decision.
