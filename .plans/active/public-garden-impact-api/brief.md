# Public Garden Impact API

**Slug**: `public-garden-impact-api`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-08-29T00:24:32.707Z`

## Problem

Public websites, partner tools, and funder integrations cannot retrieve one garden's impact from a
stable public API. They would have to understand the Green Goods indexer, multiple EAS schemas,
historical approval recipient differences, Hypercert status semantics, and the public visibility
policy themselves.

## Desired Outcome

- A caller can fetch one public garden's submitted work, protocol approvals, assessments, and
  impact certificates through a versioned JSON response.
- Individual provider failures remain visible as partial provenance instead of becoming false zero
  counts.
- The existing protected public APIs, application UI, contracts, indexer schema, and deployment
  configuration do not change.

## Scope Notes

- In scope: dependency-light response types, strict chain-aware source readers, pure aggregation,
  one Agent GET/OPTIONS route, bounded rate limiting and caching, tests, and builder documentation.
- Out of scope: UI work, writes, authentication, deployment, indexer or EAS schema changes, new
  dependencies, environment files, Linear records, and production verification.

## Success Signal

A deterministic Agent integration test can request a visible garden and receive a public-safe,
source-aware impact snapshot while failures produce the documented partial or unavailable result.
