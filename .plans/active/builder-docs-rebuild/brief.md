# Builder Docs Rebuild — Brief

**Feature Slug**: `builder-docs-rebuild`
**Status**: ACTIVE
**Created**: 2026-09-02
**Owner**: Afo (decisions) / Claude (execution)

## Problem

The builder track at docs.greengoods.app (45 pages) was authored in the repository's
agent-contract register: 29 pages under 220 words, ~5,900 hand-written words total, zero external
links at research time, entry pages that defer to repo files instead of teaching, and seven of ten
sidebar categories fronted by empty auto-generated index pages (which also breaks the teal accent).
A 2026-09-01 review meeting rated the track "context-poor, not human-friendly, no flow, no links."

## Outcome

A clear, human-friendly technical guide for developers who want to understand, explore, test, or
contribute to Green Goods: ~38 fuller pages in 8 sections, every category fronted by a real landing
page, hand-written prose in the community track's register, generated projections kept and
digest-gated, external links everywhere they teach, and the whole site agent-readable
(`llms.txt` + `.md` twins).

## Blueprint

The full research brief and page-by-page dispositions live in the review artifact
("Builder Docs Rebuild", rev 2 — private link, decisions D1–D10 locked with Afo on 2026-09-02):
https://claude.ai/code/artifact/3f55d286-fca3-4d50-b032-d8e61001268a

`spec.md` in this hub carries the durable subset: target IA, locked decisions, page templates,
and tone contract. Research basis: reference-site evidence packs (GainForest, EAS, Hats, Octant),
Diátaxis, Google developer style highlights, Write the Docs, and a full local inventory.

## Constraints

- Keep the docs trust machinery: generators, digest gates (`check:docs-generated`),
  `source_of_truth` frontmatter, `docs:audit:ci`.
- The `feature/qa-report` stream owns the QA pages (rewritten 2026-09-01/02, merged in #793);
  this effort only aligns links and placement around them.
- No big-bang: each phase is an independently shippable PR to `develop`; the site is never worse
  mid-migration. Moved or deleted slugs always get redirects.
- Root-scripts consolidation (240 scripts) is explicitly out of scope (D6, separate follow-up).
