# Docs Package Context

Loaded when working in `docs/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun dev` (from docs/) | Start Docusaurus dev server (port 3000) |
| `bun build` (from docs/) | Build static documentation site |
| `bun run serve` | Preview production build locally |

## Architecture

```
docs/
├── docs/
│   ├── builders/        # Developer-facing documentation
│   │   ├── agentic/     # Claude Code, intent/context/spec engineering
│   │   ├── packages/    # Per-package guides (admin, agent, client, contracts, indexer, shared)
│   │   ├── integrations/# EAS, Gardens, Hats, Hypercerts, Karma, Unlock, CookieJar, Passkey
│   │   ├── quality/     # Test cases, GH Actions, Husky, agentic eval
│   │   ├── testing/     # Vitest, Playwright, Storybook, Forge
│   │   └── architecture/# ERD, sequence diagrams, modular approach
│   ├── community/       # User-facing guides by role
│   │   ├── gardener/    # Work documentation, offline sync, payouts
│   │   ├── operator/    # Garden creation, action management, governance
│   │   ├── evaluator/   # Assessments, querying, badges, analytics
│   │   ├── funder/      # Funding, vaults, hypercerts, recognition
│   │   └── member/      # Community involvement, conviction voting
│   └── reference/       # Glossary, changelog, FAQ, credits
├── src/                 # Custom Docusaurus components and pages
├── static/              # Static assets (images, favicons)
└── docusaurus.config.ts # Site configuration
```

## Key Patterns

### Content Organization

- **Role-based community docs**: Organized by user archetype (gardener, operator, evaluator, funder, member), not by feature
- **Builder docs by concern**: Organized by development area (packages, integrations, quality, testing, architecture)
- **Reference section**: Lookup material (glossary, FAQ, changelog)

### File Conventions

- Use `.mdx` for pages with React components or interactive elements
- Use `.md` for pure Markdown content
- Frontmatter required: `title`, `sidebar_position`, optional `description`
- Images go in `static/img/` with descriptive names

### Cross-References

- Link to glossary terms: `[term](/reference/glossary#term-anchor)`
- Link between sections: use relative paths `../community/gardener/getting-started`
- Reference code patterns: point to `.claude/context/{package}.md` for implementation details

## Critical Rules

1. **Never duplicate implementation details** — docs describe "what" and "why", context files describe "how"
2. **Role-based structure is sacred** — don't reorganize community docs by feature; users find content by their role
3. **Broken links throw errors** — `onBrokenLinks: 'throw'` in config means dead links fail the build
4. **Site URL**: `https://docs.greengoods.app`
5. **Docusaurus v4 future flag enabled** — use v4-compatible APIs

## Anti-Patterns

- Adding code implementation guides to community docs (those belong in builders/)
- Creating pages without sidebar_position (they won't appear in navigation)
- Hardcoding URLs instead of using relative links
- Putting meeting notes or transcripts in docs/ (those go through `/meeting-notes` skill to GitHub issues)

## Documentation References (on-demand)

- Domain glossary: `docs/docs/reference/glossary.md`
- System architecture diagrams: `docs/docs/builders/architecture/`
- Impact model: referenced across community guides
- Docusaurus config: `docs/docusaurus.config.ts`
