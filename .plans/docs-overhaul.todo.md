# Documentation Overhaul: Two-Track Community + Builder Docs

**GitHub Issue**: TBD
**Branch**: `docs/overhaul-two-track`
**Status**: ACTIVE — Phase 1-4 complete, Phase 5-7 remaining
**Created**: 2026-03-07
**Last Updated**: 2026-03-08

---

## Completed Work (Phase 1-4)

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

---

## Remaining Work

### Phase 5: UI Polish & Design Improvements

#### 5.1 Fix HomepageFeatures broken links
**Files**: `docs/src/components/HomepageFeatures/index.tsx`
**Priority**: P0
**Details**:
- Update all 4 pathway cards to new routes:
  - Gardener: `/gardener/get-started` → `/community/gardener-guide/joining-a-garden`
  - Operator: `/operator/get-started-and-roles` → `/community/operator-guide/creating-a-garden`
  - Evaluator: `/evaluator/get-started` → `/community/evaluator-guide/joining-a-garden`
  - Developers: `/developers/getting-started` → `/builders/getting-started`
- Update card titles to match new naming ("Developers" → "Builders")
- Consider adding Funder + Community paths or consolidating into 2 tracks

#### 5.2 Dark mode status badge fixes
**Files**: `docs/src/components/docs/styles.module.css`
**Priority**: P0
**Details**:
- Add `[data-theme="dark"]` overrides for all status badge classes
- statusLive, statusPlanned, statusImplemented, statusExternal, statusImplementedIndexing
- Use darker backgrounds with lighter text for dark mode (e.g., `#065f46` bg, `#6ee7b7` text)

#### 5.3 NextBestAction visual enhancement
**Files**: `docs/src/components/docs/NextBestAction.tsx`, `docs/src/components/docs/styles.module.css`
**Priority**: P1
**Details**:
- Add subtle gradient or primary-tinted background to distinguish from regular cards
- Add arrow/chevron icon (→) to CTA button
- Increase top margin for breathing room from preceding content
- Add hover scale on CTA button (`transform: scale(1.02)`)

#### 5.4 Interactive card hover states
**Files**: `docs/src/components/docs/styles.module.css`
**Priority**: P1
**Details**:
- Add `transition: border-color 150ms ease, box-shadow 150ms ease` to all card classes
- Add hover states: `border-color: var(--ifm-color-primary-light)` + subtle shadow
- Apply to: `.roleCard`, `.stepFlowItem`, `.journeyItem`, `.featureState`, `.nextAction`

#### 5.5 Clean up placeholder assets
**Files**: `docs/static/img/`
**Priority**: P1
**Details**:
- Remove unused Docusaurus placeholder SVGs:
  - `undraw_docusaurus_mountain.svg`
  - `undraw_docusaurus_react.svg`
  - `undraw_docusaurus_tree.svg`
  - `docusaurus.png`
  - `docusaurus-social-card.jpg`
- Verify nothing references these before deleting

#### 5.6 Mermaid global theme
**Files**: `docs/docusaurus.config.ts`
**Priority**: P2
**Details**:
- Configure mermaid theme colors in themeConfig to use Green Goods palette
- Set `mermaid: { theme: { light: 'base', dark: 'dark' }, options: { ... } }`
- Map primary green, blue, purple, amber to mermaid node/edge colors

#### 5.7 Footer brand enhancement
**Files**: `docs/docusaurus.config.ts` or swizzled Footer
**Priority**: P2
**Details**:
- Add logo to footer
- Add tagline: "Making grassroots conservation visible, verifiable, and funded"
- Consider social icons (GitHub, Discord, Paragraph)

#### 5.8 Section dividers for pillar pages
**Files**: New component `docs/src/components/docs/SectionDivider.tsx`
**Priority**: P3
**Details**:
- Create a subtle section divider component with organic/nature motif
- Replace `---` horizontal rules in pillar pages
- Could be a simple CSS gradient line with leaf accent or seed dot pattern

#### 5.9 Page component entrance animations
**Files**: `docs/src/components/docs/styles.module.css`
**Priority**: P3
**Details**:
- Apply `cardEnter` animation (already defined) to doc components
- Add staggered delays via CSS custom properties
- Respect `prefers-reduced-motion` (already handled globally)

---

### Phase 6: Content Enrichment

#### 6.1 Template application to builder pages (~50 pages)
**Priority**: P2
**Details**:
Apply standardized templates to existing builder pages:
- [ ] **7 Package pages** → Template: Overview, Features & Functionality, How It Relates To Other Packages, Resources
- [ ] **14 Integration pages** → Template: Why We Love..., Product Use Cases, How We Integrate (Technical), Resources
- [ ] **6 Deployment pages** → Template: Deployment Checklist, Build Environments, Making A Deployment, Resources
- [ ] **5 Testing pages** → Template: How To Approach Tests, Completing Test Coverage, Running Tests, Resources
- [ ] **5 Quality Assurance pages** → Template: consistent format TBD

#### 6.2 External content enrichment
**Priority**: P2
**Details**:
Pull in content from external sources to enrich existing pages:
- [ ] v0.1 spec enrichment from Downloads `Green Goods v0.1`
- [ ] v0.4 spec enrichment from Downloads `Green Goods v0.4`
- [ ] v1.0 spec enrichment from Downloads `Green Goods v1.0` (85KB)
- [ ] Paragraph articles → community pillar pages (tone, examples, quotes)
- [ ] GTM Strategy PDF → Where We're Headed (roadmap detail)
- [ ] Operator onboarding notes → Operator Guide pages

#### 6.3 Community guide alignment
**Priority**: P2
**Details**:
- [ ] Verify all guide pages follow the Guide template (3-4 step action guide)
- [ ] Cross-reference FAQ and Glossary against v1.0 spec terminology
- [ ] Standardize "on-chain" (hyphenated) across all docs
- [ ] Ensure consistent NextBestAction flow through each guide track

---

### Phase 7: Live App Screenshots

#### 7.1 Client PWA screenshots
**Priority**: P3 (requires live app access)
**Details**:
Screenshots from greengoods.app:
- [ ] Passkey login flow
- [ ] Garden selection / action list
- [ ] MDR workflow (Media, Details, Review screens)
- [ ] Work submission confirmation

#### 7.2 Admin dashboard screenshots
**Priority**: P3 (requires live app access)
**Details**:
Screenshots from dashboard.greengoods.app:
- [ ] Garden dashboard overview
- [ ] Work review queue
- [ ] Assessment creation
- [ ] Vault/endowment view

---

## Verification Checklist

### Per-Phase
- [x] Phase 1-4: `npm run build` — zero errors ✅
- [ ] Phase 5: Dark mode renders correctly for all components
- [ ] Phase 5: All hover states accessible (keyboard focus-visible too)
- [ ] Phase 6: Templates consistently applied, no placeholder sections
- [ ] Phase 7: All `{/* IMAGE PLACEHOLDER */}` comments replaced

### Final
- [ ] `cd docs && npm run build` — zero errors, zero broken links
- [ ] Both sidebars fully match target spec
- [ ] Tone/voice consistent (keyword bolding, warm accessible language)
- [ ] All 70+ legacy redirects still work
- [ ] Dark mode renders correctly for all pages + components
- [ ] "on-chain" standardized across all docs
- [ ] No unused placeholder assets remain
