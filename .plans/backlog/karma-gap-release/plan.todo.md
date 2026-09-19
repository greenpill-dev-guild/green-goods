# Karma GAP Arbitrum Release Plan

**Feature Slug**: `karma-gap-release`
**Stage**: `backlog`
**Status**: `BACKLOG: waiting on a legacy GardenAccount compatibility design; the repair itself is merged (PR #775)`
**Created**: `2026-09-10`
**Last Updated**: `2026-09-10`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep the predecessor's locked behavior: GardenAccount owns the Karma project, admin access follows live Owner and Steward Hats, historical Project Updates stay untouched | Settled in the closed repair hub; this hub owns only the release |
| 2 | Arbitrum only, Aiyeloja Family Garden first | Matches the deployed integration and limits release risk |
| 3 | Upgrade, reconciliation, and expansion are separate human-authorized actions | Implementation proof is not broadcast authority |
| 4 | No release until a reviewed legacy-compatibility design exists | Existing GardenAccounts cannot execute UUPS upgrades |

## Research / Plan Gate

- [ ] Write the legacy GardenAccount compatibility options into `spec.md` with the evidence for each
- [ ] Get the chosen option independently reviewed and record it in the decision log
- [ ] Confirm whether the deferred GardenToken release is compatible with that option
- [ ] Run a fresh read-only inventory and record its blockers

## Implementation Steps

### Step 1: Legacy compatibility design
Decide how existing Arbitrum GardenAccounts reach the Karma access-sync behavior, and prove it with
faithful resolver tests and a pinned Arbitrum fork run.

### Step 2: Karma module upgrade with historical seeding
Reconstruct the complete `GAPImpactCreated` inventory, pair each `workUID` with its `impactUID`,
and prepare the seeded `upgradeToAndCall` described in `release-runbook.md`. Missing or conflicting
pairs block the upgrade.

### Step 3: Aiyeloja canary
With release authorization, apply the chosen path to Aiyeloja Family Garden only, then verify its
live post-state: sync version, canonical Karma URL, details and image, Owner and Steward membership
and admin access, revocation behavior, and indexer projections.

### Step 4: Expansion
Only after the canary verifies, expand to the remaining Arbitrum Gardens from a fresh inventory.

### Step 5: Admin proof
Record authenticated Brave proof of the `/garden` Karma panel for the states real Gardens reach.

## Validation

- [ ] Contract tests through the package Bun wrappers, including storage-layout and upgrade-safety checks
- [ ] Pinned Arbitrum fork proof of the compatibility path and the seeded upgrade
- [ ] Read-only inventory with no release blockers before each broadcast
- [ ] Live post-state verification of the canary before expansion
- [ ] Authenticated Brave `/garden` proof
