# Karma GAP Arbitrum Release Spec

## Summary

Release the merged Karma GAP integration repair to Arbitrum. The contracts, indexer projection,
shared hooks, and admin panel shipped in PR #775 behind a release boundary: nothing was deployed,
upgraded, or reconciled. One design decision comes first, because the existing GardenAccounts are
ERC-6551 accounts created directly from the GardenAccount implementation and cannot execute a UUPS
upgrade.

## Users

- Primary: Garden Owners and Stewards who manage their Garden's Karma profile from the admin
  `/garden` panel.
- Secondary: gardeners and funders reading Garden work on Karma.

## Functional Requirements

1. A reviewed compatibility design gives existing Arbitrum GardenAccounts the Karma access-sync
   behavior, or an equivalent authority path, without giving the Karma module permanent project
   admin rights.
2. The Karma module upgrade seeds every historical `GAPImpactCreated` work-to-update pair in the
   same `upgradeToAndCall`, so an upgraded module never duplicates a historical Project Update
   (`release-runbook.md`).
3. A fresh read-only inventory (`arbitrum-karma-inventory.ts`) runs against finalized Arbitrum
   state before each release decision and blocks on any release blocker.
4. Aiyeloja Family Garden is the first canary. Expansion waits until its live post-state verifies
   the sync version, canonical Karma URL, details and image, Owner and Steward membership and admin
   access, revocation behavior, and indexer projections.
5. The deferred GardenToken release ships only once it is compatible with the chosen design.
6. Authenticated Brave proof of the admin `/garden` Karma panel is recorded for the states a real
   Garden reaches.

## Research Evidence

- Closed predecessor: `karma-gap-integration-repair`, recorded in `.plans/ARCHIVE.md` and
  recoverable from Git history. Its decisions 10 to 12 set the Arbitrum-only scope, the Aiyeloja
  canary, the separation of upgrade from reconciliation, and the need for a separate
  legacy-compatibility design.
- `ea8300311` deferred the incompatible GardenToken release.
- `release-runbook.md` and `arbitrum-karma-inventory.ts` were carried over from the predecessor
  unchanged apart from the command path.
- Canary reference: https://www.karmahq.org/project/aiyeloja-family-garden

## Human Judgment Points

- Which compatibility shape to adopt for the legacy accounts. Nothing is designed yet, and every
  option needs independent review.
- Release authorization: implementation, review, deployment, reconciliation, and expansion stay
  separate human-authorized boundaries.
- Protected surfaces: Solidity storage layout, GardenAccount UUPS authorization, Karma resolver
  addresses and schema identifiers, and the release inventory.

## Non-Functional Constraints

- Additive, storage-safe contract changes only; preserve storage gaps and legacy selectors.
- Karma failure stays isolated from Garden creation, metadata edits, and Work approval.
- No broadcast by default; every mutating mode is explicit and human-authorized.
- Contract work runs through the package Bun wrappers, never raw Forge.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Compatibility design, Karma module upgrade, GardenToken release | `contracts` | Critical surface; independent review before any broadcast |
| Indexer and shared read-back after release | `state_api` | Verify projections from live post-state |
| Admin `/garden` panel proof | `ui` | Authenticated Brave proof only |
| Release review and closure | `qa_pass_1`, `qa_pass_2` | Sequential |

## Risks

- Risk: a compatibility path that widens authority or strands project ownership.
  Mitigation: faithful resolver tests, a pinned Arbitrum fork proof, and independent review before
  any broadcast.
- Risk: duplicated historical Project Updates.
  Mitigation: the seeded upgrade fails closed on missing, mismatched, zero, or conflicting pairs.
- Risk: expanding before the canary proves out.
  Mitigation: expansion waits on Aiyeloja's verified live post-state.
