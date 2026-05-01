# Docs Freshness Routine

**Slug**: `docs-freshness-routine`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-25`
**Last Updated**: `2026-05-01`

## Problem

The core community docs were just tightened after Matt's review: Gardener, Operator, and Funder guides now focus on the reviewed user paths and the new Donate / Endow / Remove language. The copy is in good shape, but the visual layer is now the likely drift point.

The latest visual pass found that all referenced images exist and the built docs render cleanly, but several media assets no longer carry the revised docs as well as they should:

- Admin screenshots are stale, dark, empty, or too zoomed out for the step they explain.
- The Submit Work dashboard screenshot does not clearly show the Work Dashboard state described in the copy.
- Donate and Endow currently reuse the same funder illustration, which makes the new three-flow funder guide less distinct.
- The app UI is actively changing, so replacing screenshots before that work lands would create churn.

## Desired Outcome

- Keep the completed community docs copy pass stable.
- After the UI update lands, refresh only the media needed for the scoped community paths.
- Use real client/admin/docs surfaces for screenshots and social assets, not fabricated placeholders.
- Preserve the current narrowed sidebar and docs structure.
- Leave a clear QA trail that proves images exist, render correctly, and match the revised copy.

## Scope Notes

- In scope:
  - `docs/docs/community/gardener-guide/index.mdx`
  - `docs/docs/community/gardener-guide/joining-a-garden.mdx`
  - `docs/docs/community/gardener-guide/uploading-your-work.mdx`
  - `docs/docs/community/operator-guide/index.mdx`
  - `docs/docs/community/operator-guide/creating-a-garden.mdx`
  - `docs/docs/community/operator-guide/making-an-assessment.mdx`
  - `docs/docs/community/operator-guide/reviewing-work.mdx`
  - `docs/docs/community/operator-guide/creating-impact-certificates.mdx`
  - `docs/docs/community/funder-guide/index.mdx`
  - `docs/docs/community/funder-guide/donating-to-a-garden.mdx`
  - `docs/docs/community/funder-guide/funding-a-garden.mdx`
  - `docs/docs/community/funder-guide/withdraw-from-a-vault.mdx`
  - Referenced media under `docs/static/img/screenshots/` and `docs/static/img/social/`
  - Docs chrome checks for the affected pages only
- Out of scope:
  - App UI/i18n changes for Donate / Endow / Remove
  - Contract, shared type, indexer, schema, or API changes
  - New docs navigation architecture
  - Broad screenshot refreshes outside the core community path
  - Funder tax/legal language beyond the current plain-language disclaimer

## Success Signal

The next media refresh can be run as one contained docs PR after the UI settles: updated screenshots/social images are wired into the scoped pages, the generated docs render cleanly on desktop and mobile, and `bun run docs:audit`, `bun run build:docs`, and `bun run lint:vocab` pass with no new warnings from the touched community docs.
