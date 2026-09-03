# Builder Docs Rebuild Plan

**Feature Slug**: `builder-docs-rebuild`
**Status**: ACTIVE
**Created**: 2026-09-02
**Last Updated**: 2026-09-02

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Five phases, each an independently shippable PR to `develop` | Diátaxis anti-big-bang; site never worse mid-migration; avoids stacked-PR CI Gate gaps |
| 2 | ~~One lane branch per phase~~ **Amended by Afo 2026-09-02: all phases proceed on `feature/builder-docs-rebuild`**; PR #795 grows with each phase | Afo's explicit direction after Phase 1 review; single review surface, one CI stream |
| 3 | Hybrid integration mechanism: pages become hand-owned MDX that render generated projection data via a component | Meaning stays human-editable (D4); concrete details keep digest-gated provenance |
| 4 | Skills catalog generated from `.claude/skills/*/README.md` with `SKILL.md` description fallback | Catalog complete on day one (D8); improves as READMEs land |
| 5 | Mermaid zoom implemented site-wide, not per-page | Every diagram benefits; one mechanism to maintain |
| 6 | Redirect entries land in the same PR as each slug move or deletion | No window where old links dead-end |
| 7 | QA pages (`quality/*`) stay owned by the qa-report stream; this effort only re-parents and cross-links | Avoid rework of pages rewritten 09-01/02 (#793) |

## Requirements Coverage

| Requirement (decision) | Phase | Status |
|------------------------|-------|--------|
| D1 consolidated Testing Guide | 4 | ⏳ |
| D2 journeys deleted + redirects | 3 | ✅ |
| D3 Economics Explorer → Reference | 4 | ⏳ |
| D4 hybrid integration pages | 1 (mechanism) + 3 (prose) | ✅ |
| D5 llms.txt + .md twins | 5 | ⏳ |
| D7 real category landings | 1 (CSS fallback) + 3 (pages) | ✅ Packages + Integrations landings live; remaining categories Phase 4 |
| D8 Skills catalog + Working with Agents | 1 (generator) + 4 (prose/READMEs) | ✅ generator 26e2f6cf3; prose pending |
| D9 Design page under Architecture | 4 | ⏳ |
| D10 License page in Reference | 4 | ⏳ |
| D11 CI & GH Actions under Testing & QA | 4 | ⏳ |
| D12 Anatomy of a Work Submission (tentative) | 3 | ✅ built; Afo judgment pending |
| ERD layered + zoomable | 1 | ✅ 26e2f6cf3 + ade03f693 |
| Spine rewrites (Getting Started, First Contribution, System Overview) | 2 | ✅ 6b7d408c4 (tone gate open) |
| Package template ×7 incl. new QA page | 3 | ✅ |
| Link audit: every page has next steps + external links | 5 | ⏳ |
| CONTRIBUTING.md circularity fix | 5 | ⏳ |

## Phase 1 — Generators & mechanics (lanes `state_api` + `ui`, this branch)

### Step 1.1: Layered ERD
**Files**: `scripts/docs/renderers.mjs`, `scripts/docs/generate.test.mjs`, regenerated `docs/docs/builders/architecture/erd.mdx`
**Details**: `renderErd` emits three focused diagrams (core protocol / funding / commitments) from
the ontology projection instead of one 21-entity graph. Test asserts layer membership and that no
entity is dropped.

### Step 1.2: Site-wide Mermaid pan-zoom
**Files**: `docs/package.json`, `docs/docusaurus.config.ts` or `docs/src/` client module
**Details**: attach pan-zoom to rendered Mermaid SVGs (pinned dependency), keyboard-safe,
reduced-motion respectful. Verify on the regenerated ERD page via docs build.

### Step 1.3: Integration projection mechanism (hybrid, D4)
**Files**: `scripts/docs/generate.mjs`, `scripts/docs/renderers.mjs`, `scripts/docs/generate.test.mjs`, new docs component, converted `docs/docs/builders/integrations/*.mdx`
**Details**: generator emits one digest-gated projection data file; a docs component renders a
named integration's deployment/indexer tables (indexer section only when configured). The seven
generated integration MDX pages become hand-owned pages that keep their current intro text (Phase 3
rewrites prose) and embed the component. `check:docs-generated` covers the data file.

### Step 1.4: Skills catalog generator (D8)
**Files**: `scripts/docs/renderers.mjs`, `scripts/docs/generate.mjs`, `scripts/docs/source-readers.mjs`, `scripts/docs/generate.test.mjs`, new `docs/docs/builders/agentic/skills.mdx`, `docs/sidebars.ts`
**Details**: `renderSkills` reads `.claude/skills/*/README.md` (fallback: `SKILL.md` frontmatter
description), emits the generated catalog page with required trust frontmatter; sidebar entry under
Agentic Development.

### Step 1.5: Sidebar accent fallback
**Files**: `docs/src/css/custom.css` (+ small client module if needed)
**Details**: builders teal holds on every `/builders/*` route including category index pages, ahead
of the Phase 3 real-landing fix.

### Step 1.6: Redirects plumbing
**Files**: `docs/package.json`, `docs/docusaurus.config.ts`
**Details**: wire `@docusaurus/plugin-client-redirects` with an empty, documented redirect map;
entries land with each later move/deletion (Decision 6).

## Phase 2 — The spine
Getting Started (absorbs env-management) · First Contribution · System Overview (absorbs
modular-approach, local-vs-global, ethereum-alignment) + redirects. Tone check with Afo on the
first page before the other two.

## Phase 3 — Sections
Monorepo Map landing + package pages ×7 (incl. new `packages/qa`) · Integrations landing + meaning
blocks on all ten pages · Anatomy of a Work Submission (D12 — Afo judges rendered result) · Data
Model & Ontology consolidation (entity matrix + commitment state diagrams) · journeys deleted (D2)
+ redirects · Persona Surfaces → Reference.

## Phase 4 — Design, agents, testing
Design page under Architecture (D9) · Working with Agents landing + 13 skill READMEs (D8) ·
Testing Guide consolidation (D1) + redirects · CI & GH Actions under Testing & QA (D11) ·
Economics Explorer → Reference (D3) · License page (D10) + community Credits slimmed.

## Phase 5 — Sweep
`llms.txt` + `.md` twins (D5) · track-wide link audit (next steps + external links per page) ·
CONTRIBUTING.md one-way pointer · final `docs:audit` green · redirect map verification.

## CLAUDE.md Compliance
- [x] No package-level env files touched; docs generators read repo sources only
- [x] Generated pages keep trust frontmatter + digest gates
- [ ] Implementation Quality Contract applied per phase (no speculative abstractions)

## Test Strategy
- **Unit**: `scripts/docs/generate.test.mjs` covers renderer changes (layer membership, conditional
  sections, skills fallback); `docs/scripts/docs-audit.test.mjs` stays green.
- **Integration**: `bun run docs:generate` + `bun run check:docs-generated` (digest honesty),
  `bun run docs:audit:ci`, `bun run build:docs` (includes redirects plugin + pan-zoom).
- **E2E/manual**: rendered ERD zoom + sidebar accent verified in the built site preview.

## Validation
- [ ] Phase 1: docs generator tests pass · docs:generate idempotent · docs:audit:ci green · build:docs green
- [ ] Fresh Evidence Receipt recorded in `handoffs/claude-state-api.md` before lane marked passed

## Implementation Notes

- Phase 3 divergences: the entity matrix relocated to its own generated page under Architecture
  instead of being absorbed into Data Model (a 3,600-word merge helped no reader); all five
  lifecycle state machines live on Data Model, and Anatomy links the work-display-status anchor
  rather than embedding the diagram.
- Deferred (Afo, 2026-09-02): revisit the Architecture landing for stronger protocol capture once
  Phases 3-4 surround it; reassess what it should still say that Anatomy and Data Model now cover.
- Tone rule 6 (no em dashes) applied to all Phase 3 prose.
