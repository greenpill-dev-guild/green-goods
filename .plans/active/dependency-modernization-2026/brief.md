# Dependency Modernization 2026

**Slug**: `dependency-modernization-2026`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-07-16T03:08:08.105Z`

## Problem

Green Goods has accumulated compatible security fixes, developer-tooling updates, runtime
refreshes, and several non-contract major migrations after completing the TypeScript 7 upgrade.
Updating them as one lockfile sweep would make regressions difficult to attribute and roll back,
especially across offline persistence, wallet/passkey transactions, the indexer, and shared UI.

## Desired Outcome

- Remove known direct critical/high dependency findings and modernize supported package families.
- Improve build, test, browser, documentation, observability, and runtime support without changing
  public Green Goods behavior or persisted data contracts.
- Leave every upgrade wave independently testable and revertible on `develop`.

## Scope Notes

- In scope: compatible dependency updates, Vite 8, supported Wagmi 3, Transformers.js 4, other
  non-contract majors, Bun/Node/PostgreSQL maintenance, and Envio 2.x maintenance.
- Out of scope: OpenZeppelin 5, Chainlink CCIP 2, Envio 3, Tokenbound/Kernel upgrades, contract
  broadcasts, production deployment, hosted indexer cutover, or public API/data-schema changes.

## Success Signal

All admitted waves pass their security, package, cross-package, runtime, and authenticated-browser
gates with no public API, persisted-state, wallet, contract, indexer-query, or user-journey regression.
