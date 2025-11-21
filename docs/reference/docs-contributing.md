# Contributing to Documentation

Green Goods uses GitBook + Git Sync. This page explains how to contribute to the documentation from the monorepo.

## Repo + GitBook Layout

- **Source of truth:** `docs/` directory in the monorepo. GitBook pulls directly from this folder through `.gitbook.yaml`.
- **Legacy files:** The old root docs (Architecture, Developer Guide, Platform Overview, Contracts Handbook, Karma GAP, theme system) were retired in favor of the GitBook pages. Always edit the new files (e.g. `developer/architecture.md`).
- **Assets:** stored in `.gitbook/assets/` with subdirectories for `logos/`, `screenshots/`, `diagrams/`, `examples/`, and `guides/`. See the [asset README](../.gitbook/assets/README.md) for file naming and TODOs.

## Workflow

1. **Clone the repo** and create a branch as usual.
2. **Edit markdown files** in `docs/`. Use standard markdown; GitBook-specific MDX isn’t required.
3. **Preview locally** by reading the markdown or, if needed, using GitBook’s preview by pushing to a branch (Git Sync will show the new content in the linked GitBook space).
4. **Run linting** (optional but recommended): `bun format` touches markdown too via Biome.
5. **Open a PR**. Label it `docs`.

## Style Notes

- **Headings:** `# Title`, `## Sections`, `### Subsections`. Avoid skipping levels.
- **Tone:** friendly, direct, and actionable. Address the reader (“you can…”) when giving instructions.
- **Links:** use relative links for internal docs (e.g. `../guides/gardeners/logging-work.md`). Use absolute URLs only for external resources.
- **Callouts:** use quotes/paragraphs instead of GitBook-specific syntax so everything renders in GitHub as well.
- **Code blocks:** specify the language (` ```ts `, ` ```graphql `, etc.) to enable syntax highlighting in GitBook.

## Screenshots & Diagrams

- Place new assets in `.gitbook/assets/<type>/`.
- Update `.gitbook/assets/README.md` if you add notable assets or fulfill TODOs from the priority list.
- Keep file sizes reasonable (<1 MB ideal). Use SVG for diagrams when possible.
- Reference images using relative paths, e.g. `![MDR Workflow](../.gitbook/assets/diagrams/mdr-workflow-diagram.svg)`.

## GitBook Sync Tips

- `.gitbook.yaml` already includes `docs/**/*.md` and image formats. No extra config needed per file.
- GitBook automatically rebuilds when changes land on the tracked branch (usually `main` or `develop`).
- If you edit directly in GitBook’s UI, it will open a PR back to this repo. Prefer editing locally so changes stay reviewable.

## Getting Help

- Open a discussion or issue on GitHub, or ask in [Telegram](https://t.me/+N3o3_43iRec1Y2Jh).
- Mention `@greenpill-dev-guild/docs` (if available) or ping a maintainer in Discord/Telegram for doc reviews.

