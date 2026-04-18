---
title: Docs Freshness Routine — Backlog
created: 2026-04-18
status: idea
owner: docs
origin_session: uploading-your-work rewrite + per-route OG cards
tags: [docs, social-cards, drift, routine]
---

# Docs Freshness Routine — Backlog

Captured follow-ups after the `Submit Work` rewrite + L1 per-route social cards
(commits `c8245a65`, `713e65ec`, `a5176641`). All below are discrete, pickable
work items for a docs routine or a human maintainer.

## Status of today's work

Shipped:
- `Submit Work` page rewrite grounded in client code (`docs/docs/community/gardener-guide/uploading-your-work.mdx`)
- 6 live-captured client screenshots at `docs/static/img/screenshots/client-work-*.png`
- Site-wide social card refreshed to 1440×900 capture of `docs.greengoods.app/` home
- Per-route `image:` frontmatter + card for 5 share-worthy pages
- CI: `deploy-docs.yml` now deploys on `develop` (no more merge-to-main gate)

## Backlog

### L2 — Scripted per-route card regeneration

Promote the one-shot Playwright snippet to a repo-tracked tool so cards stay in
sync when docs UI changes:
- Add `docs/scripts/gen-social-cards.mjs` (Playwright batch capture at 1440×900, cwebp convert, write to `docs/static/img/social/`)
- Add `docs/package.json` script: `"gen:social-cards": "node scripts/gen-social-cards.mjs"`
- Routine could drive it on a cadence (Sunday? after any `themeConfig` change?)

### Expand L1 to more pages

Current 5: joining-a-garden, uploading-your-work, track-status-and-attestations,
creating-a-garden (operator), funder getting-started. Candidates to add:
- `/how-it-works`, `/why-we-build`, `/where-were-headed` — top-level explainers
- `/community/gardener-guide/garden-payouts` — gardener monetization page
- `/community/operator-guide/creating-impact-certificates`, `making-an-assessment`
- `/community/funder-guide/vaults-and-hypercerts`
- `/glossary` — terminology reference, gets deep-linked
- FAQ — high search traffic

### Rewrite adjacent gardener-guide pages in the same grounded style

- `common-errors.mdx` — currently generic; could ground in real error states + screenshots (rejected work, sync failures)
- `track-status-and-attestations.mdx` — currently thin (~50 lines); expand with Work Dashboard narrative + real status screenshots
- `garden-payouts.mdx` — likely stale; verify against current payout/vault UI
- `offline-sync-and-drafts.mdx` — overlaps with the offline section of `uploading-your-work`; consolidate or differentiate

### Refresh legacy deck assets

These are linked from various docs pages and show pre-redesign UI:
- `docs/static/img/community/mdr-methodology.webp` — 5-phone MDR deck, OLD UI
- `docs/static/img/community/deck-intro.webp`, `deck-regen-stack.webp`, `deck-allo-alliance.webp`, `deck-socials.webp` — positioning decks, verify accuracy
- `docs/static/img/community/impact-value-cycle.webp` — concept diagram, check Work→Tokenize→Evaluate→Fund labels match current glossary

### Prevent future build breaks

Add a lightweight lint pass that catches MDX 2 incompatibilities before push:
- Flag `<https://...>` / `<http://...>` autolinks inside `.md`/`.mdx` files (these parse as JSX in MDX 2+ and block the build — caused today's `urban-greening-comment-package` blocker)
- Could live in `docs/scripts/docs-audit.mjs` (already exists) as another check
- Could also run as a pre-commit hook in `husky` config

### Drift detection (routine-sized task)

Routine runs weekly, checks for:
- Screenshots in `docs/static/img/screenshots/` older than the last `packages/admin/package.json` or `packages/client/package.json` bump → surface as "likely stale"
- Social cards in `docs/static/img/social/` older than the last change to the page they describe → regenerate candidates list
- Any `.mdx` with `last_verified` > 90 days old → flag to `docs-audit.mjs` warnings

### L3 — Dynamic OG generation (later, bigger)

If per-page L1 cards grow past ~15-20 pages, switch to templated generation:
- Option A: `satori` + build-time Node script; renders React-like JSX to PNG using Inter/Jakarta Sans
- Option B: `@vercel/og` — same approach, Vercel's flavor
- Template: Green Goods logo + page title + role badge + breadcrumb, Warm Earth palette from `design/language.md`
- Wire to the `docusaurus-plugin-content-docs` lifecycle so cards regenerate on every `bun run build`

### Consistency pass

Small hygiene items surfaced during the rewrite:
- Sidebar labels vs H1: `uploading-your-work.mdx` kept sidebar `"Uploading Your Work"` but has H1 `"Submit Work"` by explicit ask. Audit whether other pages have similar gaps and document the convention.
- Vocab: confirm no remaining "MDR" labels in visible UI (NextBestAction titles, inline prose in non-rewritten pages)
- Frontmatter completeness: 7 pre-existing audit warnings (see `bun run audit`) — fix `source_of_truth` gaps on `drs-2026-paper-outline.md`, `regenerative-design-framework.md`, `regenerative-design-principles.md`

## Intake for the docs routine

Suggested intake rubric when a routine picks this up:
1. Pick one item from L2/Expand-L1/Rewrite sections per run
2. Always regenerate `og:image` if touching any page's hero, title, or positioning copy
3. Commit as `docs(<scope>): <summary>` on `develop` — no PR-to-main needed since `develop` now deploys
4. Post a one-line summary to Discord `#green-goods` channel with the new deployed URL(s)

## Out of scope

- Rewriting docs content structure (navigation, sidebar hierarchy) — separate design task
- i18n / translation pipeline for docs — separate initiative
- Docusaurus major version upgrade (3.9.2 → 3.10.0 noted in build logs) — ops task
