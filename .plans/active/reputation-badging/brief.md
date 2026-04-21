# Reputation & Badging

**Slug**: `reputation-badging`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-04-17`

## Problem

Season One participation today has no persistent signal beyond on-chain work history. Operators can not quickly see who is a verified gardener, who has sustained contribution, or who holds stewardship authority; sibling projects (Coop, WEFA) that share identity and attestation infrastructure have no portable way to gate or recognize Green Goods contributors. The result is duplicated vetting per project and invisible reputation inside the active gardener pool.

## Desired Outcome

- Six badge types deployed — **Verified Gardener, Active Contributor, Stewardship, Garden Operator, Community Builder, Impact Verified** — each anchored by an Unlock Protocol lock (ERC-721 keys) + `GreenGoodsBadge` EAS attestation.
- Issuance is automatic via the Greenwill background service (groundwork issue #457) watching Green Goods data and granting keys + writing attestations.
- Badges are **portable**: sibling projects recognize them via the shared EAS schema + Unlock locks without Green Goods-specific integration.
- Active across **3+ pilot gardens** and demonstrated in at least one sibling project by **2026-06-30**.

## Scope Notes

- In scope:
  - `packages/agent` (or new `packages/greenwill`) badge registry + per-badge evaluators + Greenwill issuer loop + Unlock client + EAS writer.
  - `packages/contracts/deployments/{chainId}-latest.json` — 6 Unlock lock addresses + 1 shared `GreenGoodsBadge` EAS schema UID.
  - `packages/shared/src/hooks/useBadges.ts` + `modules/badges.ts` (display metadata, tier formatting).
  - GreenWill broadcast contract-confidence gate: upgrade-preservation unit coverage, workflow integration coverage, Arbitrum fork support-flow test (per admin-ui-revamp history, 2026-04-19).
- Out of scope:
  - Custom badge-issuance contracts — Unlock factory + existing EAS contracts cover the surface.
  - Client-side badge minting flows — all issuance is service-side.
  - Transferability or badge trading (locks are non-transferable / soulbound).

## Success Signal

A cross-project recognition check from Coop or WEFA returns a live Green Goods badge from at least 3 pilot gardens, with `useBadges` returning the same shape in both projects (shared schema verified).
