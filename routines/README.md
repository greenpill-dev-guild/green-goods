# Claude Routines

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's actual config lives on claude.ai/code/routines; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

## Files

- `gg-pr-review.md` — GitHub-triggered inline PR review (replaces `claude-code-review.yml`)
- `gg-morning-watch.md` — Scheduled weekday operational health checks; writes GitHub Issues
- `gg-dream-on.md` — Nightly cross-project exploration; session-only output
- `gg-data-analyst.md` — Weekly Dune + PostHog maintenance; writes PR to develop + issues

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

| Label | Routine | Color |
|---|---|---|
| `routine:sync-develop:blocked` | sync-develop workflow | `d73a4a` |
| `routine:watch:indexer` | gg-morning-watch | `0e8a16` |
| `routine:watch:pilot-activity` | gg-morning-watch | `0e8a16` |
| `routine:watch:ci-pulse` | gg-morning-watch | `0e8a16` |
| `routine:watch:onchain-sanity` | gg-morning-watch | `0e8a16` |
| `routine:metrics:anomaly` | gg-data-analyst | `d73a4a` |
| `routine:metrics:digest` | gg-data-analyst | `0366d6` |

Create them with `gh label create "<name>" --color "<hex>" --description "<purpose>"`.
