# Builder Docs Rebuild — Eval

**Feature Slug**: `builder-docs-rebuild`
**Last Updated**: 2026-09-02

## Per-phase gates (every phase)

1. `bun run test:docs` and `node --test scripts/docs/generate.test.mjs` green.
2. `bun run docs:generate` then `bun run check:docs-generated` — clean tree, digests honest.
3. `bun run docs:audit:ci` green (trust frontmatter, canonical slugs, README parity).
4. `bun run build:docs` green (redirects, MDX, mermaid all compile).
5. Every moved/deleted slug in the phase has a redirect entry in the same PR.

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

## Human gates

- Tone: Afo approves the first spine page (Getting Started) before the remaining rewrites adopt
  the voice (Phase 2).
- D12: Afo judges Anatomy of a Work Submission from the first rendered version (Phase 3).
- Design page direction reviewed against `design/` truth before publish (Phase 4).

## Explicit non-goals

Root-scripts consolidation (D6) · QA page rewrites (owned by qa-report stream) · community-track
rewrites beyond Credits slimming and Design Rationale relocation.
