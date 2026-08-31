# Documentation and Agent Guidance Authority Plan

**Feature Slug**: `documentation-agent-guidance-authority`
**Status**: `ACTIVE`
**Created**: `2026-08-30`
**Last Updated**: `2026-08-30`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Final source surface is 20 Community, 44 Builder, and 6 Reference pages. | A small complete map is easier for people and agents to navigate and validate. |
| 2 | Vercel deploys; GitHub Actions validates. | One owner per responsibility removes competing deployment state. |
| 3 | Task routing is machine-readable and generates its public explanation. | Skill relationships need deterministic checks without duplicated prose. |
| 4 | Public docs never own implementation contracts. | Public pages explain flows; upstream code, package guides, contexts, and DesignMD own behavior. |
| 5 | The ontology generates terminology and persona projections. | Shared semantics should have one machine-readable authority. |
| 6 | Git history is the only archive. | An in-repo archive remains searchable and looks current even when it is not. |
| 7 | Redirect only to a truthful successor. | A misleading redirect is worse than a clear 404. |
| 8 | Live deployment waits for a clean, committed revision. | A production receipt must identify the exact artifact that was built. |

## Requirements Coverage

| Requirement | Step | Status |
|---|---|---|
| Clean ownership checkpoint and selected ledger | 0 | Local selection complete; committed integration SHA pending |
| Vercel configuration and GitHub validation-only workflow | 1-2 | Checked-in docs configuration complete; live project Root Directory correction and successful preview pending |
| Task-to-skill routing contract and generated page | 3 | Complete |
| Internal/public authority reversal and skill consolidation | 4 | Complete; active predecessor citations now point directly to their owning DesignMD contracts |
| Six ontology-backed Reference pages | 5 | Complete |
| Twenty current Community pages | 6 | Complete |
| Dead docs code, artifacts, and assets removed | 7 | Complete; docs Knip scan is clean |
| Final hard gates and 79-route production sitemap | 8 | Local gates complete; production Vercel verification pending |

## Execution Steps

### 0. Pin ownership and predecessors

- Record the current SHA and dirty path ownership in `artifacts/migration-ledger.json`.
- Treat `.plans/active/builder-docs-authority/` as the 44-page Builder selection.
- Keep unrelated runtime and plan changes out of this scope.

### 1. Establish Vercel deployment

- Keep `docs/vercel.json` beside the Docusaurus project, using the root Bun lockfile and root docs checks.
- Configure only the `green-goods-docs` Vercel project with Root Directory `docs` and source access outside that directory; other projects share the monorepo and must not consume the docs build contract.
- Verify preview, production, direct links, assets, redirects, search, and sitemap before cutover.

### 2. Retire GitHub Pages and close Builder migration

- Keep `.github/workflows/docs.yml` validation-only.
- Remove Pages metadata, commands, `.nojekyll`, and `CNAME` after domain verification.
- Rewrite `docs/README.md` and remove the broken protocol-status command.

### 3. Add task routing

- Add `.claude/context/task-routing.json`.
- Add the `agentic` docs generator scope and `/builders/agentic/task-routing`.
- Redirect `/builders/glossary` to `/glossary` while preserving the 44-page Builder count.
- Validate routed skills, task boundaries, mutation rules, and handoffs.

### 4. Reverse authority and minimize skill support

- Replace public-doc implementation contracts with links to upstream package/context/DesignMD sources.
- Distill and delete the selected debug and design support files.
- Extend guidance checks against downstream public-doc authority language.

### 5. Consolidate Reference documentation

- Move banned vocabulary policy to `scripts/data/`.
- Generate `/glossary` from ontology, projections, supporting terms, and vocabulary policy.
- Keep FAQ, glossary, formal ontology, Product History, Design Rationale and Sources, and Credits.

### 6. Reduce Community documentation

- Keep the approved 20-page orientation, gardener, steward/evaluator, funder, and claims map.
- Merge recovery and troubleshooting beside the action that can fail.
- Delete hidden, future-facing, and duplicated role pages; add only truthful redirects.

### 7. Remove dead docs surfaces

- Remove copied endpoints, five zero-consumer components, selected internal artifacts, and unused static assets.
- Keep Revenue Explorer and `recharts`.
- Run the docs workspace dead-code scan and targeted consumer searches.

### 8. Harden and deploy

- Fail on hidden/unreachable pages, zero-consumer assets, bad links/anchors/redirects/authority, generated drift, and invalid ontology roles.
- Run the full selected docs, ontology, design, and guidance gates.
- Deploy sequentially from `main` and verify the 79-route production sitemap.

## Test Strategy

- Generator tests: deterministic ordering, normalized hashing, source validation, scope selection, missing/extra/stale output, task-routing validation, and vocabulary projection.
- Audit tests: navigation reachability, unlisted pages, assets, redirects, anchors, generated sources, and authority direction.
- Ontology tests: glossary anchors, supporting terms, frontmatter personas, and QA catalog roles.
- Build proof: `bun run test:docs`, `bun run build:docs`, and final sitemap counts.
- Live proof: Vercel preview and production checks only against an exact clean commit.

## Validation

- `bun run docs:audit:ci`
- `bun run check:docs-generated`
- `bun run check:ontology`
- `bun run check:skill-behavior`
- `bun run check:guidance-links`
- `bun run check:codex-guidance`
- `bun run test:review-guardrails`
- Design checks when DesignMD or design guidance changes
- `bun run test:docs`
- `bun run build:docs`
- docs workspace dead-code scan
- `git diff --check`
- one final `bun run eval:skills`; unavailable external evaluation remains blocked
