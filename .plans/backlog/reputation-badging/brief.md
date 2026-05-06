# Reputation & Badging

**Slug**: `reputation-badging`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-17`

## Problem

Season One already has an initial GreenWill badge surface for the three current badges: `genesis`, `first-work`, and `first-support`. This hub is the later six-badge portable reputation expansion, not the April 28 initial-badge closeout.

## Desired Outcome

- Six later badge types deployed — **Verified Gardener, Active Contributor, Stewardship, Garden Operator, Community Builder, Impact Verified** — each anchored by an Unlock Protocol lock (ERC-721 keys) + `GreenGoodsBadge` EAS attestation.
- Issuance is automatic via the Greenwill background service (groundwork issue #457) watching Green Goods data and granting keys + writing attestations.
- Badges are **portable**: sibling projects recognize them via the shared EAS schema + Unlock locks without Green Goods-specific integration.
- Active across **3+ pilot gardens** and demonstrated in at least one sibling project by **2026-06-30**.

## Scope Notes

- This plan is deferred backlog work. The near-term presentation scope is only to verify and present the existing three initial GreenWill badges.
- In scope:
  - `packages/agent` (or new `packages/greenwill`) badge registry + per-badge evaluators + Greenwill issuer loop + Unlock client + EAS writer.
  - `packages/contracts/deployments/{chainId}-latest.json` — 6 Unlock lock addresses + 1 shared `GreenGoodsBadge` EAS schema UID.
  - `packages/shared/src/hooks/useBadges.ts` + `modules/badges.ts` (display metadata, tier formatting).
  - GreenWill broadcast contract-confidence gate: upgrade-preservation unit coverage, workflow integration coverage, Arbitrum fork support-flow test.
- Out of scope:
  - Custom badge-issuance contracts — Unlock factory + existing EAS contracts cover the surface.
  - Client-side badge minting flows — all issuance is service-side.
  - Transferability or badge trading (locks are non-transferable / soulbound).

## Success Signal

A cross-project recognition check from Coop or WEFA returns a live Green Goods badge from at least 3 pilot gardens, with `useBadges` returning the same shape in both projects (shared schema verified).
