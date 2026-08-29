# Karma GAP Integration Repair

**Slug**: `karma-gap-integration-repair`  
**Stage**: `active`  
**Priority**: `p1`  
**Created**: `2026-08-26`

## Problem

Green Goods creates Karma GAP projects and Project Updates, but the integration does not preserve
the authority, data, or rendering contracts Karma expects. Project creation races ahead of steward
access synchronization, indirect admin writes revert at Karma's ProjectResolver ownership boundary,
unsupported JSON fields and `ipfs://` proof URLs render incorrectly, profile imagery is written in
the wrong shape, and indexer failures are swallowed or registered against the wrong emitter.

## Desired Outcome

Every Arbitrum Garden has one GardenAccount-owned Karma project whose live admin set follows the
Garden Owner and Steward Hats, whose public details continuously reflect canonical Garden metadata,
and whose future approved Work appears as a readable Karma Project Update with working Green Goods
and EAS links. Stewards can see sync health and retry safe reconciliation from `/garden`.

## Scope Notes

- **In scope**: additive GardenAccount/Karma contract behavior, deterministic creation ordering,
  access and metadata reconciliation, Project Update schema repair, replay-safe indexer projection,
  shared status/retry hooks, admin status/recovery UI, tests, and release/migration tooling that is
  safe to inspect without broadcasting.
- **Out of scope**: production deployment, GardenAccount proxy upgrade, on-chain reconciliation,
  Celo activation, Sepolia activation, historical Project Update duplication, Karma upstream UI
  changes, and any change from Project Update to Impact semantics.

## Success Signal

Local contract integration tests use a resolver with Karma's real ownership semantics and prove
that GardenAccount-origin project creation plus Owner/Steward reconciliation succeeds, revoked
stewards lose project admin rights, future Project Updates contain only supported fields and HTTP
links, and the indexer/admin surfaces expose deterministic pending, failed, retrying, and synced
states without a live transaction.
