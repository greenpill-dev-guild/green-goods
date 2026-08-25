# Module Seams and Velocity

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

**Slug**: `module-seams-and-velocity`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-08-23`

## Problem

Green Goods has strong new module patterns, but they are not yet consistent across shared, client,
admin, and indexer code. Mutation-heavy modules remain difficult to construct and test directly,
large barrels make test imports expensive, several UI controllers are not tested at their seam,
and parts of the validation harness make small changes pay full-repository costs. These weaknesses
reinforce each other: poor seams produce broad mocks, broad mocks keep the import graph large, and
the large graph makes reliable local proof slow.

## Desired Outcome

- Every committed shared, client, admin, and indexer module reaches A- or A in the module-health
  ledger, except the explicitly deferred Card Endow activation and contract-redeployment rows.
- Mutation and controller behavior is directly testable through declared ports, controllers,
  repositories, planners, or command boundaries.
- Local validation selects the smallest safe package graph, uses a compatible toolchain, remains
  green under load, and reuses Turbo results without weakening strict or critical gates.
- Coverage enforcement moves out of the pull-request critical path to nightly and `main`, starting
  at measured floors and ratcheting monthly.
- Existing runtime behavior, error strings, offline-first guarantees, public exports, and contract
  deployment semantics remain stable unless a lane explicitly names a product decision.

## Scope Notes

- In scope: the Wave 0 validation harness; mutation seams; shared repositories, adapters, commands,
  hooks, and providers; client and admin controllers and composition; indexer test architecture and
  helper separation; Vitest project routing; direct-tested-seam enforcement; and wave-boundary
  health and velocity snapshots.
- Execution: all remaining work is implemented and committed directly in the shared checkout on
  `develop`. Original lane blocks remain acceptance criteria inside wave batches, not separate
  branch, worktree, pull-request, or agent delivery units.
- Deferred: agent `HandlerServices`, Telegram and blockchain-client adapter work, caller-side
  contract capability wrappers, any contract change that requires redeployment, and Card Endow
  activation until it is scheduled.
- Prohibited: dependency installs or upgrades, contract broadcasts, package-level `.env` files,
  lowering critical gates, extending receipt-debt expiry, or creating branches, worktrees, pull
  requests, or subagents for this program.

## Success Signal

The final Module Health snapshot grades every committed shared, client, admin, and indexer module
A- or A, and the Velocity snapshot meets the agreed suite and CI targets with fresh receipts.
