# Builder Docs Rebuild — Eval

**Feature Slug**: `builder-docs-rebuild`
**Last Updated**: 2026-10-09

## Per-phase gates (every phase)

1. `bun run --cwd docs test` and `node --test scripts/docs/generate.test.mjs` green.
2. `node scripts/docs/generate.mjs` then `node scripts/docs/generate.mjs --check` — clean tree, digests honest.
3. `node docs/scripts/docs-audit.mjs --ci` green (trust frontmatter, canonical slugs, README parity).
4. `bun run --cwd docs build` green (redirects, MDX, mermaid all compile).
5. Every moved/deleted slug in the phase has a redirect entry in the same PR.

(Develop retired the `docs:*` root scripts on 2026-09-22; `scripts/data/command-migration.json`
maps the old names to these.)

## Outcome gates (checked at sweep, Phase 5)

| Gate | Measure | Baseline (2026-09-01) | Target |
|------|---------|------------------------|--------|
| Fragmentation | builder pages under 220 words | 29 of 45 | 0 hand-written pages under ~300 words without a deliberate hub role |
| Link poverty | external links across the track | 0 (3 after #793) | every hand-written page links out; track ≥ 1 link/150 words |
| Flow | pages ending with a next-steps block | ~0 | all hand-written pages |
| Landings | categories fronted by real doc pages | 3 of 10 | all sections |
| Accent | teal holds on every /builders/* route | broken on 7 category indexes | holds everywhere |
| Diagrams | largest single diagram | 21 entities, no zoom | ≤ ~10 nodes per diagram, all zoomable |
| Agent-readability | llms.txt + .md twins served | none | both, in build output |
| Package coverage | packages with a docs page | 6 of 7 | 7 of 7 |

## Sweep results (2026-09-23)

Measured on the local production build at `a2d5a207d`: page text from the sources, rendered
checks in Playwright headless Chromium (unauthenticated, light theme).

| Gate | Result | Status |
|------|--------|--------|
| Fragmentation | 14 of 29 hand-written pages are under 300 words: nine integration pages (their projections render the rest), the Integrations and Packages landings, License, Economics Explorer, and the Agent package page | Afo's call |
| Link poverty | every hand-written page links out; 121 external links across 13,374 words, one per 111 | ✅ |
| Flow | all 29 hand-written pages end with next steps | ✅ |
| Landings | every builder section has a real landing page except Reference | Afo's call |
| Accent | the same teal on the active sidebar link across all 41 builder routes | ✅ |
| Diagrams | 17 diagrams render with no errors; the largest are two generated Data Model layers at 12 nodes each, counting shared anchors like Garden and Work; every diagram expands and zooms | Near target |
| Agent-readability | `llms.txt` (94 lines) and 67 Markdown twins in the build output | ✅ |
| Package coverage | 7 of 7 | ✅ |

Re-measured 2026-10-09 on the merged tree (`wc -w` on each hand-written source, frontmatter and
diagrams included; external links counted as `http(s)` targets outside greengoods.app): 28 pages,
13,997 words, 97 external links (one per 144 words); 6 pages under 300 words (License, Gardens,
Karma, ENS, Hypercerts, the Packages landing). Build: 69 routes, 69 Markdown twins, `llms.txt`
96 lines, 225 redirect pages. Every integration page with an on-chain footprint now renders its
deployment projection (EAS and Tokenbound added; Passkeys states it has none).

## Human gates

- Tone: Afo approves the first spine page (Getting Started) before the remaining rewrites adopt
  the voice (Phase 2).
- D12: Afo judges Anatomy of a Work Submission from the first rendered version (Phase 3).
- Design page direction reviewed against `design/` truth before publish (Phase 4).

## Explicit non-goals

Root-scripts consolidation (D6) · QA page rewrites (owned by qa-report stream) · community-track
rewrites beyond Credits slimming and Design Rationale relocation.
