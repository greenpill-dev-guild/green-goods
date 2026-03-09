# Documentation Overhaul: Two-Track Community + Builder Docs

**GitHub Issue**: TBD
**Branch**: `docs/overhaul-two-track`
**Status**: IMPLEMENTED — Phase 1-7 complete
**Created**: 2026-03-07
**Last Updated**: 2026-03-08

---

## Completed Work (Phase 1-6)

### Phase 1: Foundation ✅
- [x] Import + optimize 13 media assets from Downloads → static/img/
- [x] Rewrite sidebars.ts → two-track (communitySidebar + buildersSidebar)
- [x] Add 30+ new redirects in docusaurus.config.ts
- [x] Move 28 files (developers/ → builders/, operator/ → community/operator-guide/, etc.)
- [x] Delete old directories (concepts/, developers/, operator/, gardener/, evaluator/)
- [x] Add Community link to navbar

### Phase 2: Community Narrative Pillars ✅
- [x] Welcome to Green Goods — 4 H2 sections, mermaid diagrams, image references
- [x] How It Works — 4 H2 sections, passkey + attestation chain mermaid diagrams
- [x] Why We Build — 3 H2 sections, SDG table, Eight Forms of Capital mermaid
- [x] Where We're Headed — 3 H2 sections, Gantt roadmap, Regen Stack mermaid

### Phase 3: Builder Restructuring ✅
- [x] Getting Started — moved + restructured into 4 H2 sections
- [x] How To Contribute — enriched with 3 H2 sections
- [x] Architecture index page with package boundaries table + system context mermaid
- [x] 4 architecture sub-pages (local-vs-global, erd, modular-approach, sequence-diagrams)

### Phase 4: Validation ✅
- [x] `npm run build` — zero broken links
- [x] All 67 sidebar doc IDs resolve to files
- [x] All 38 NextBestAction hrefs valid
- [x] All old path references eliminated
- [x] Footer links updated to new paths

### Phase 5: UI Polish & Design Improvements ✅
- [x] 5.1 HomepageFeatures — removed orphaned component
- [x] 5.2 Dark mode status badge overrides — all 5 variants have `[data-theme="dark"]` CSS
- [x] 5.3 NextBestAction visual enhancement — gradient background, scale(1.02) CTA hover, increased margin-top to 3rem
- [x] 5.4 Interactive card hover states — transitions + hover on `.journeyItem`, `.featureState`; `:focus-visible` on all 5 card classes + CTA button
- [x] 5.5 Placeholder assets — already cleaned up
- [x] 5.6 Mermaid global theme — `base`/`dark` themes with Green Goods palette (green, blue, purple, amber)
- [x] 5.7 Footer brand enhancement — logo, tagline, social links already in Connect column
- [x] 5.10 Fix category index 404s — `generated-index` with descriptions on all 5 community guide categories
- [ ] 5.8 Section dividers for pillar pages (P3 — skipped for now)
- [ ] 5.9 Page component entrance animations (P3 — skipped for now)

### Phase 6: Content Enrichment ✅ (partial — 6.1 + 6.3 done, 6.2 deferred)
- [x] 6.1 Template application to builder pages:
  - [x] **Metadata pass** — frontmatter, StatusBadge, NextBestAction added to all Live pages (19 files)
  - [x] **Packages template** (contracts.mdx) — restructured to: Overview, Features & Functionality, How It Relates To Other Packages, Resources
  - [x] **Integrations template** (eas.mdx) — restructured to: Why We Love EAS, Product Use Cases, How We Integrate (Technical), Resources
  - [x] **Integrations dedup** — removed duplicate entity matrix from overview.mdx, replaced with link to entity-matrix.mdx
  - [x] **Deployment template** (5 guides, not status.mdx) — restructured to: Deployment Checklist, Build Environments, Making A Deployment, Resources
  - [x] **Testing template** (5 pages) — restructured to: How To Approach Tests, Completing Test Coverage, Running Tests, Resources
  - [x] **Quality pages** — 4 Live pages got metadata (template TBD), 1 Planned (test-cases) got keywords only
- [x] 6.3 Community guide alignment:
  - [x] Standardized "on-chain" (hyphenated) — fixed `onchain` in welcome.mdx keyword + config tagline
  - [x] Verified NextBestAction flow through all 5 guide tracks (gardener, operator, evaluator, funder, community)
- [ ] 6.2 External content enrichment (deferred — requires manual source files from Downloads)

---

## Remaining Work

### Phase 7: Visual Content — Mermaid Diagrams + Screenshots ✅
- [x] Replaced all 48 `{/* IMAGE PLACEHOLDER */}` comments with contextual Mermaid diagrams
- [x] Captured 9 live app screenshots via Playwright (localhost with dark mode)
  - 8 admin screenshots: dashboard, gardens, garden-detail, work-queue, actions, endowments, garden-impact, garden-community
  - 1 client screenshot: passkey-login (production)
- [x] Placed 15 screenshot references across 13 doc pages
- [x] Build passes, zero broken references, all temp files cleaned
- [x] See `docs-overhaul-remaining.todo.md` for Phase 8-13 (authenticated screenshots, integration content, etc.)

### Deferred Items
- [ ] 5.8 Section dividers for pillar pages (P3)
- [ ] 5.9 Page component entrance animations (P3)
- [ ] 6.2 External content enrichment (needs manual source files)
- [ ] Phase 8-13: See `docs-overhaul-remaining.todo.md`

---

## Verification Checklist

### Per-Phase
- [x] Phase 1-4: `npm run build` — zero errors ✅
- [x] Phase 5.2: Dark mode renders correctly for status badges ✅
- [x] Phase 5: All hover states accessible (keyboard focus-visible too) ✅
- [x] Phase 5-6: `npm run build` — zero errors ✅
- [x] Phase 6: Templates consistently applied to all Live builder pages ✅
- [x] Phase 7: All `{/* IMAGE PLACEHOLDER */}` comments replaced with Mermaid diagrams + 9 screenshots

### Final
- [x] `cd docs && npm run build` — zero errors, zero broken links ✅
- [x] Both sidebars fully match target spec ✅
- [x] Tone/voice consistent (keyword bolding, warm accessible language) ✅
- [x] All 70+ legacy redirects still work ✅
- [x] Dark mode renders correctly for all pages + components ✅
- [x] "on-chain" standardized across all docs ✅
- [x] No unused placeholder assets remain ✅
