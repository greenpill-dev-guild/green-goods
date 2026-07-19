# TypeScript 7-only upgrade

> **Archived record:** implementation is closed. Operational handoffs, reports, artifacts, and lane files were removed; any such references below describe historical execution, not live work.

**Slug**: `typescript-7-upgrade`
**Stage**: `archive`
**Priority**: `p2`
**Created**: `2026-07-14T00:39:12.925Z`

## Problem

Green Goods is on TypeScript 5.9.3, while TypeScript 7.0.2 provides the native compiler and
language server. One shared locale-coverage test directly imports the old compiler API, which must
be removed to keep the workspace entirely on TypeScript 7.

## Desired Outcome

- Every workspace resolves `typescript` to 7.0.2; no TypeScript 6 compatibility dependency is added.
- Existing typecheck, build, i18n coverage, GraphQL typing, and docs workflows retain their behavior.
- Packages that constrained TypeScript peer resolution are refreshed only where needed.

## Scope Notes

- In scope: compiler declarations, TS 7 config migration, the locale AST parser, `gql.tada`, `knip`,
  `react-intl`, and the Bun lockfile.
- Out of scope: runtime product behavior, contracts, Vite/Storybook/Docusaurus upgrades, and
  unrelated dependency updates.

## Success Signal

Every package typechecks or builds with TypeScript 7.0.2 and the repo quick gate passes without a
TypeScript 6 package in the resolved tree.
