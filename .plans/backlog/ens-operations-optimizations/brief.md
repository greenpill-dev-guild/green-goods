# ENS Operations Optimizations

**Slug**: `ens-operations-optimizations`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-25T23:55:33Z`

## Problem

The production ENS integration now has core claim, release, migration, and sponsor-funding paths, but the next layer of reliability work should not block the immediate deploy. Operators still need better historical observability, automated smoke checks, and richer UX around cooldowns, retries, and cross-chain settlement.

## Desired Outcome

- ENS operators can see sponsor runway, registration/release status, and settlement health without manually querying contracts.
- Deploys and migrations have repeatable post-deploy smoke checks against live Arbitrum and Ethereum receiver state.
- Users get clearer recovery guidance for cooldowns, delayed CCIP delivery, and failed/underfunded sponsor cases.

## Scope Notes

- In scope: ops dashboards, live smoke automation, indexer-backed ENS status, cooldown/retry UX, RPC resilience, alerting.
- Out of scope: blocking the current ENS release path, changing the greengoods.eth parent ownership model, or replacing CCIP before the current integration is stable in production.

## Success Signal

ENS support shifts from manual troubleshooting to routine monitoring: the team can detect low sponsor balance, delayed CCIP delivery, stale receiver records, and user-facing claim/release failures before they become recurring support issues.
