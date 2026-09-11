# Karma GAP Arbitrum Release

**Slug**: `karma-gap-release`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-09-10`

## Problem

The Karma GAP integration repair is merged (PR #775, PRD-839) but has not been released. Until
the upgraded contracts reach Arbitrum, production keeps the old Karma behavior that PRD-839
describes: garden profiles render incorrectly and steward access does not sync. Releasing is not a
routine upgrade. The existing Arbitrum GardenAccounts were created directly from the GardenAccount
implementation rather than behind the AccountProxy, so they cannot execute a UUPS upgrade, even
when the Garden NFT owner asks. The GardenToken release was deferred for the same reason.

## Desired Outcome

- Every Arbitrum Garden gets the repaired behavior: a GardenAccount-owned Karma project, admin
  access that follows the Owner and Steward Hats, current profile details and image, and readable
  Project Updates with Green Goods and EAS links.
- Existing Gardens are reached through a reviewed compatibility path, with Aiyeloja Family Garden
  as the canary.
- Historical Project Updates stay untouched.

## Scope Notes

- **In scope**: a legacy GardenAccount compatibility design, the Karma module upgrade with the
  historical Project Update seeding described in `release-runbook.md`, the Aiyeloja canary,
  expansion to the remaining Arbitrum Gardens, and authenticated Brave proof of the admin
  `/garden` Karma panel.
- **Out of scope**: Celo and Sepolia activation, rewriting or duplicating historical Project
  Updates, Impact semantics, Karma upstream UI changes, and any new permanent protocol admin.

## Success Signal

Aiyeloja Family Garden's Karma profile shows its canonical details and image, its Owner and
Stewards hold project admin, a newly approved Work appears as a readable Project Update, and the
admin `/garden` panel reports it as synced, all verified from live post-state.
