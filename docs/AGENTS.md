# Documentation — Agent Guide

Use this guide for `docs/**`. [README.md](README.md) owns the Docusaurus content map,
authored/generated boundary, local workflow, and deployment setup.

## Content rules

- Explain current user flows and stable rationale. Read the named implementation authorities
  before describing behavior; public pages do not override package implementation contracts.
- Keep audience, owner, status, and `source_of_truth` frontmatter accurate. Every live page needs
  sidebar or category-index navigation.
- Do not edit generated MDX directly. Change its authoritative source and run the declared generator.
- Keep private QA results and identities out of the public site. The QA catalog defines public
  cases; observations and run evidence follow the [QA privacy contract](../.claude/context/qa.md).
- Use the root writing guidance for prose. For theme/component work, also read [DESIGN.md](DESIGN.md)
  and the root frontend guidance; prose-only edits do not require browser proof.
- Routine definitions under `routines/` have their own [operating contract](routines/README.md).
  Editing a routine document does not authorize running it or writing to external systems.

## Commands

Run from `docs/` after rendering the root validation plan:

- `bun run audit -- --ci` — check document authorities and links.
- `bun run test` — verify documentation generators and helpers when their behavior changes.
- `bun run build` — verify navigation, MDX, theme, and production output when affected.
- `bun run check:search-index` — verify the built search index when search inputs change.

Use `bun run --cwd .. dev -- docs` to preview the site. Generated projections
use the root `docs-generated` check; the root application build does not build Docs.
