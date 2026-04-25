# Docs Freshness Routine

**Slug**: `docs-freshness-routine`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-25`

## Problem

Docs screenshots, social cards, and route-level guides drift after UI changes. The follow-ups from the Submit Work rewrite and per-route social-card pass are specific enough to become a routine backlog hub instead of staying as an idea note.

## Desired Outcome

- A repeatable docs freshness pass that keeps screenshots, OG/social cards, MDX compatibility checks, and stale `last_verified` metadata current.
- One pickable docs maintenance item per run, with clear validation and deployment expectations.
- No broad docs restructure or i18n work folded into this routine.

## Scope Notes

- In scope: scripted social-card regeneration, expanding L1 social cards, grounded gardener-guide rewrites, legacy deck asset refresh, MDX autolink linting, and stale-doc drift detection.
- Out of scope: navigation redesign, docs translation, Docusaurus major upgrade, and new product documentation architecture.

## Success Signal

Each routine run updates or verifies one docs freshness surface and leaves enough evidence for a maintainer to trust the deployed docs without redoing the whole audit.
