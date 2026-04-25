# Docs Freshness Routine Spec

## Goal

Turn the docs freshness idea note into a real backlog routine for Green Goods docs upkeep. This is a maintenance loop, not a docs redesign.

## Source Context

Recent shipped docs work included:

- Submit Work page rewrite grounded in client code.
- Six live-captured client screenshots.
- Site-wide social card refresh.
- Per-route `image:` frontmatter and social card coverage for five share-worthy pages.
- Docs deploy on `develop`.

The remaining work is routine-sized and should be picked one item at a time.

## Work Families

1. **Scripted social-card regeneration**  
   Add or run a repeatable Playwright/cwebp flow for `docs/static/img/social/`.

2. **Expand L1 social cards**  
   Add cards for high-value docs pages such as top-level explainers, gardener payout pages, operator assessment pages, vault/hypercert pages, glossary, and FAQ.

3. **Ground adjacent gardener-guide pages**  
   Refresh pages like `common-errors.mdx`, `track-status-and-attestations.mdx`, `garden-payouts.mdx`, and `offline-sync-and-drafts.mdx` against current source/UI behavior.

4. **Refresh legacy deck assets**  
   Verify old community/deck images and replace or flag stale UI/terminology.

5. **Prevent MDX build breaks**  
   Add or extend docs audit checks for MDX 2 incompatible autolinks like `<https://...>`.

6. **Detect drift**  
   Flag stale screenshots, stale social cards, and docs with `last_verified` older than 90 days.

## Routine Rule

Pick one work family per run. Do not batch a docs content rewrite, image regeneration, and lint/tooling change together unless the same page requires all three.

## Validation

- Run the relevant docs package check/build for the touched surface.
- Run `node scripts/plan-hub.mjs validate` if plan files are edited.
- For social cards or screenshots, capture or regenerate assets from the live docs/client/admin surface rather than fabricating placeholders.
