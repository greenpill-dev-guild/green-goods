# TypeScript 7-only upgrade Spec

## Summary

Upgrade the monorepo to TypeScript 7.0.2 only. Replace the one direct compiler API consumer with
Babel parsing, remove TS 7-incompatible `baseUrl` settings, and refresh the three direct packages
whose current peer ranges did not admit TS 7.

## Users

- Primary: Green Goods developers and CI.
- Secondary: editor integrations and automated code-quality tooling.

## Functional Requirements

1. Root, docs, admin, client, agent, and indexer must declare TypeScript 7.0.2.
2. Locale coverage must preserve AST-based message extraction without importing `typescript`.
3. `gql.tada`, `knip`, and `react-intl` must resolve to TS 7-compatible releases.
4. Affected tsconfigs must not use TS 7-rejected compiler options.

## Research Evidence

- Existing pattern references: Bun workspace lockfile and package-local `tsc` scripts.
- Source files, tests, or docs reviewed: all active tsconfigs; manifests; locale coverage test;
  `gql.tada` plugin configuration; TypeScript 7 announcement; live npm metadata.
- Evidence confirmed: TS 7 removes `baseUrl` and has no compiler API; only locale coverage imports
  it. Current `gql.tada`, `knip`, and `react-intl` ranges exclude TS 7; current releases accept it.
- Open inference: `gql.tada`'s current plugin path works with TS 7 as declared; package checks prove it.

## Human Judgment Points

- Decisions that need maintainer judgment: none after the TS 7-only scope lock.
- Protected or high-risk surfaces: shared i18n coverage and dependency manifests.
- Tradeoffs to keep visible during review: React Intl is refreshed only for peer compatibility; no API
  migration is assumed without existing test/build evidence.

## Non-Functional Constraints

- Package boundaries: root tooling plus docs, shared, client, admin, agent, and indexer manifests.
- Performance: measure the resulting compiler version; do not change parallelism defaults.
- Security, offline/sync: unchanged.
- Localization: static-message coverage behavior remains intact.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | n/a: no rendered behavior changes |
| State / API | `state_api` | compiler, dependency, config, and parser migration |
| Contracts | `contracts` | n/a: no contract changes |
| QA | `qa_pass_2` | targeted package proof plus repo quick gate |

## Risks

- Risk: a TS 7-compatible peer still embeds the former TypeScript API.
- Mitigation: validate shared typecheck, GraphQL typing, docs typecheck, and all package builds.
