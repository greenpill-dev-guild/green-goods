# Claude Routines

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's actual config lives on claude.ai/code/routines; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

## Files

- `gg-pr-review.md` — GitHub-triggered inline PR review (replaces `claude-code-review.yml`)
- `gg-morning-watch.md` — Scheduled weekday operational health checks; writes GitHub Issues + Discord #green-goods health summary
- `gg-client-polish.md` — Daily client PWA audit with rotating focus + bi-directional Discord; writes GitHub Issues + Discord messages
- `gg-dream-on.md` — Nightly cross-project exploration; reads Discord #research; session-only output
- `gg-data-analyst.md` — Weekly Dune + PostHog maintenance; writes PR to develop + issues + Discord #funding highlights
- `gg-grant-scout.md` — Weekly grant opportunity scouting + proposal drafting for Green Goods & Coop; writes Drive docs + Discord #funding + GitHub Issues

## Conventions

- All routine PRs target `develop`, never `main`.
- All routine branches use the `claude/<routine-name>/<topic>` prefix.
- Dedupe issues by label `routine:<name>:<category>`.
- Loop prevention: PR-review filters on `head_branch` starting with `claude/` (not on author — routine PRs carry the user's GitHub author per docs).
- See `docs/superpowers/specs/2026-04-14-claude-routines-design.md` for the full design and `docs/superpowers/plans/2026-04-14-claude-routines.md` for the rollout plan.

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.

## Required labels

Ensure these GitHub labels exist before enabling the corresponding routines:

| Label | Used by | Purpose | Color |
|---|---|---|---|
| `automated/claude-routine` | all routines | Umbrella: "authored by a Claude routine" — matches existing `automated/codex` precedent | `0075ca` |
| `routine:watch:indexer` | gg-morning-watch | Dedupe: one open issue per category | `0e8a16` |
| `routine:watch:pilot-activity` | gg-morning-watch | Dedupe | `0e8a16` |
| `routine:watch:ci-pulse` | gg-morning-watch | Dedupe | `0e8a16` |
| `routine:watch:onchain-sanity` | gg-morning-watch | Dedupe | `0e8a16` |
| `routine:metrics:anomaly` | gg-data-analyst | Dedupe: one open anomaly issue | `d73a4a` |
| `routine:polish:notes` | gg-client-polish | Dedupe: findings from Drive meeting notes | `c5def5` |
| `routine:polish:discord` | gg-client-polish | Dedupe: bug reports sourced from Discord | `5865F2` |
| `routine:polish:telegram` | gg-client-polish | Dedupe: bug reports sourced from Telegram bot | `229ED9` |
| `routine:polish:design` | gg-client-polish | Dedupe: design & accessibility issues | `d4c5f9` |
| `routine:polish:architecture` | gg-client-polish | Dedupe: architecture & pattern violations | `fbca04` |
| `routine:polish:testing` | gg-client-polish | Dedupe: test coverage gaps & quality | `0e8a16` |
| `routine:polish:performance` | gg-client-polish | Dedupe: performance & PWA issues | `e4e669` |
| `routine:polish:quality` | gg-client-polish | Dedupe: code quality & principles issues | `f9d0c4` |
| `routine:grant:deadline` | gg-grant-scout | Dedupe: grant deadlines within 14 days | `d93f0b` |

Routines apply **both** a category label (for dedupe) and `automated/claude-routine` (for discovery) on every issue or PR they author. The umbrella is what you filter on to see "everything any routine produced"; the category label is what the routine's code uses to decide "create new or append to existing."

Create them with `gh label create "<name>" --color "<hex>" --description "<purpose>"`.

## Bot API environment

Routines that consume Telegram feedback need these additional environment variables:

| Variable | Description |
|---|---|
| `BOT_API_URL` | Public URL of the Green Goods agent (e.g., `https://agent.greengoods.app`) |
| `BOT_API_TOKEN` | Bearer token for authenticating API requests to the agent |

Used by: `gg-client-polish` (read + respond), `gg-morning-watch` (read-only).
