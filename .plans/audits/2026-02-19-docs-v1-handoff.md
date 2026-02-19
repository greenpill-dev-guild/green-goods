# 2026-02-19 Docs v1 Revamp Handoff (Role-First + UX/Search Pass)

## Purpose
This report captures the current state of the Green Goods docs revamp so another agent can continue work without re-discovery.

Scope covered in this cycle:
1. Role-first IA migration and stale docs hard-delete.
2. UX and readability upgrades (journey/decision/action-first components).
3. Trust/accuracy guardrails to reduce hallucinations/out-of-date claims.
4. Search-quality pass focused on top intent queries.

## Current Docs Topology
Canonical docs tree is now:
- `docs/docs/gardener/*`
- `docs/docs/operator/*`
- `docs/docs/evaluator/*`
- `docs/docs/developers/*`
- `docs/docs/reference/*`
- `docs/docs/intro.md`
- `docs/docs/glossary.md`

Counts:
- Total docs files: `40`
- Canonical role/developer MDX files: `34`

## What Was Implemented

### 1. IA and legacy cleanup
- Legacy trees removed from published surface (concepts/features/prd/specs/old role and developer trees).
- Role-first sidebars and navbar model are active in:
  - `docs/sidebars.ts`
  - `docs/docusaurus.config.ts`
- Redirect coverage expanded for old high-traffic paths (`/welcome/*`, `/concepts/*`, `/features/*`, `/developer/*`, `/prd/*`, `/specs/*`).

### 2. UX component system and role journey upgrades
Reusable docs components live in:
- `docs/src/components/docs/AtAGlanceCard.tsx`
- `docs/src/components/docs/JourneyMap.tsx`
- `docs/src/components/docs/DecisionGuide.tsx`
- `docs/src/components/docs/QuickAnswer.tsx`
- `docs/src/components/docs/NextBestAction.tsx`
- plus style support in `docs/src/components/docs/styles.module.css`

Applied across canonical role and developer docs with:
- consistent “at a glance” blocks
- journey positioning on top pages
- intent branching on complex flows
- clear next action CTAs

### 3. Trust/accuracy model
- Status truth generated from deployment + indexer artifacts:
  - generator: `docs/scripts/generate-protocol-status.mjs`
  - output: `docs/src/data/protocol-status.generated.json`
  - rendered page: `docs/docs/developers/reference/deployment-indexer-status.mdx`
- Status taxonomy used:
  - `Live`
  - `Implemented (activation pending indexing)`
  - `Implemented (activation pending deployment)`
  - `Planned`

### 4. Frontmatter + docs contract
- Canonical frontmatter contract documented in:
  - `docs/docs/developers/reference/docs-frontmatter-contract.mdx`
- Writing standards and anti-repetition rules documented in:
  - `docs/docs/developers/reference/docs-writing-guide.mdx`

### 5. Search-quality pass (intent-focused)
High-intent query tuning completed for:
- `submit work` -> `docs/docs/gardener/submit-work-mdr.mdx`
- `review work` -> `docs/docs/operator/review-work.mdx`
- `mint hypercert` -> `docs/docs/operator/mint-and-list-hypercerts.mdx`
- `vault deposit` -> `docs/docs/operator/vaults-and-treasury.mdx`
- `query attestations` -> `docs/docs/evaluator/query-eas.mdx`

Changes included:
- stronger search-aligned titles
- expanded keywords frontmatter
- “When to use this page” sections for intent matching
- home “Popular tasks” links in `docs/docs/intro.md`

### 6. Reference quality cleanup
Reference docs were normalized and drift reduced:
- `docs/docs/reference/faq.md` rewritten for role clarity + no stale placeholders.
- metadata/trust frontmatter added to:
  - `docs/docs/reference/changelog.md`
  - `docs/docs/reference/credits.md`
  - `docs/docs/reference/design-research.md`
  - `docs/docs/glossary.md`
- stale “coming soon/future” phrasing removed from monitored reference surface.

## Guardrails Added/Updated

## docs-audit
Script: `docs/scripts/docs-audit.mjs`

Now checks:
1. Placeholder markers (`TODO/TBD/PLACEHOLDER`).
2. Stale-language patterns (coming-soon/old-roadmap style).
3. Required trust frontmatter for monitored docs.
4. Required full frontmatter for non-reference canonical docs.
5. Source-of-truth file path validity.
6. Hardcoded endpoint policy violations.
7. Empty markdown links and incomplete phrase patterns.
8. Relative markdown link target existence.
9. Duplicate prose-block warning for canonical docs.

Current scope monitored by audit:
- canonical role/dev docs
- `docs/docs/intro.md`
- `docs/docs/glossary.md`
- `docs/docs/reference/*`

## Validation Snapshot
Executed in this environment:
- `npm --prefix docs run audit:ci` -> PASS (`docs-audit: no warnings`)
- `npm --prefix docs run typecheck` -> PASS

Build status:
- `npm --prefix docs run build` -> FAIL due to local Node version mismatch.
- Observed runtime: `Node v18.18.2`
- Required by docs package: `>=20.0` (`docs/package.json` engines)

## Known Constraints / Risks
1. Build/link verification has not run in this environment due to Node version.
2. Repo working tree is heavily dirty beyond docs (do not reset/revert globally).
3. Large delete set from old docs is intentional and should remain unless migration strategy changes.

## Priority Next Actions (for next agent)
1. Run full docs build under Node 20+:
   - `npm --prefix docs run build`
2. Run manual search QA in local docs UI for top intents:
   - `submit work`
   - `review work`
   - `mint hypercert`
   - `vault deposit`
   - `query attestations`
3. If ranking needs additional boost, tune:
   - page titles/subtitles
   - early-heading phrasing
   - cross-links from role landing pages
4. Optional: add lightweight docs search regression checklist file in `.plans/` for release gates.

## Key Files for Fast Pickup
Core config/navigation:
- `docs/docusaurus.config.ts`
- `docs/sidebars.ts`

Trust/search/quality:
- `docs/scripts/docs-audit.mjs`
- `docs/scripts/generate-protocol-status.mjs`
- `docs/src/data/protocol-status.generated.json`
- `docs/src/data/endpoints.ts`

Primary intent-target docs:
- `docs/docs/intro.md`
- `docs/docs/gardener/submit-work-mdr.mdx`
- `docs/docs/operator/review-work.mdx`
- `docs/docs/operator/mint-and-list-hypercerts.mdx`
- `docs/docs/operator/vaults-and-treasury.mdx`
- `docs/docs/evaluator/query-eas.mdx`

Reference quality docs:
- `docs/docs/reference/faq.md`
- `docs/docs/reference/changelog.md`
- `docs/docs/reference/design-research.md`
- `docs/docs/reference/credits.md`
- `docs/docs/glossary.md`

## Notes for Next Agent
- Treat `docs/docs/developers/reference/deployment-indexer-status.mdx` as canonical for feature activation state.
- Prefer status language from generated truth data, not prose-only assumptions.
- Avoid introducing hardcoded endpoint literals outside approved reference files/components.
- Keep frontmatter trust fields current when editing any monitored doc.
