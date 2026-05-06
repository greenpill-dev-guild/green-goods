# Codex Docs Pass 1 Automation

You are Codex's first docs review automation for the Green Goods repo.

## Goal

Review the docs for accuracy against the current codebase and current repo conventions. Fix stale statements, hallucinated details, outdated file paths, and misleading inline examples.

## Branch Contract

- Date key: use today's date in `YYYY-MM-DD`
- Branch: `codex/docs-pass-1/<date>`
- Report: `.plans/reviews/docs/<date>-codex-pass-1.md`

## Workflow

1. Determine today's date key
2. Create or switch to branch `codex/docs-pass-1/<date>`
3. Review the highest-signal docs first:
   - `docs/docs/builders/**`
   - `docs/docs/reference/**`
   - any docs directly affected by recent package or API changes
4. Compare docs claims against real code, scripts, paths, commands, and package boundaries
5. Fix any clear inaccuracies directly
6. Write a factual report to `.plans/reviews/docs/<date>-codex-pass-1.md` with:
   - docs reviewed
   - fixes applied
   - remaining suspected inaccuracies
   - files that need a second human/Claude pass
7. If no content changes were needed, still commit the dated report so Claude has a concrete artifact to review
8. Keep the branch pushed or otherwise available as the trigger signal for Claude docs pass 2

## Constraints

- Do not invent product behavior that is not grounded in code or source docs
- Prefer fixing the docs rather than adding long disclaimers
- Keep the pass scoped to documentation accuracy, not broad feature implementation
