# CLAUDE.md

Claude Code harness notes for Green Goods. The agent-neutral repository contract is
[`AGENTS.md`](AGENTS.md). Read it first, then the nearest package `AGENTS.md`. Shared product,
architecture, validation, Git, safety, and package rules belong there or in `.claude/context/`, not
in this file.

## Claude Entry Points

- Path-scoped rules in `.claude/rules/*.md` load by file glob and point to their canonical context.
- `.claude/skills/` is the shared Claude/Codex skill source. `.agents/skills` is its symlinked Codex
  discovery path; never create a second copy.
- Feature execution truth lives in `.plans/{ideas|backlog|active|archive}/<feature-slug>/`; the
  passive `plan` skill owns lifecycle and Linear mirroring.
- Use [`.claude/context/codebase-architecture.md`](.claude/context/codebase-architecture.md) for
  architecture opportunities, structural review, and deep-module or seam vocabulary.
- Use [`.claude/context/validation-pipeline.md`](.claude/context/validation-pipeline.md) for the
  intent ladder, commands, receipt freshness, conditional gates, and stop conditions.

## Claude Commands

```bash
bun run dev:doctor -- --profile web  # Non-mutating local readiness check
bun run dev                          # Start the repo-native PM2 development stack
bun run dev:stop                     # Stop repo-owned development services
bun run test:fast                    # Cache-aware full-scope iteration after targeted proof
bun run test:fast:force              # Same scope without cache reuse
bun run eval:skills                  # One semantic routing run after skill trigger wording stabilizes
```

Use `bun run test`, never `bun test`. Commands shared by all agents are listed in `AGENTS.md`; package
commands live in the nearest package guide. Service variants and operational entrypoints live in
[`scripts/README.md`](scripts/README.md).

## Claude Tool Routing

- For authenticated local UI QA, use the Claude Code Chrome/Chromium extension to claim the
  already-open authenticated Brave profile or tab. If the extension cannot reach it, use visible
  computer control of that Brave window. Do not substitute an isolated browser profile; report the
  proof as `BLOCKED` when neither path is available.
- Linear MCP is the visibility and coordination surface. Follow `AGENTS.md § Linear Workspace` and
  [`.claude/context/linear-routing-rules.md`](.claude/context/linear-routing-rules.md); keep Plan Hub
  lane truth in `.plans`.
- Before a PostHog query, select the project named by `AGENTS.md § PostHog Routing`. Never trust the
  connector's starting project.

## Output Style

Lead with the answer, outcome, finding, or blocker. Keep routine responses short. When a decision
turns on evidence, show the measurement, file, command, or contract field rather than adding more
adjectives. Preserve material uncertainty and avoid restating the request.

## Scope Discipline

- When the user asks only for an answer, audit, review, or text in chat, do not edit files.
- Ambiguous, multi-package, or high-risk work follows the root two-phase scope-lock rhythm.
- Do not infer authority for deployment, broadcast, merge, publication, destructive cleanup, or
  branch changes from permission to implement code.
- Follow `AGENTS.md § Multi-Agent Repo Safety` before Git mutations or when unexpected working-tree
  changes appear.

## Codex Dispatch

Set `CODEX="$(.claude/scripts/resolve-codex-binary.sh)"` before direct Codex CLI calls. The resolver
honors a valid override, checks installed app bundles, then falls back to `codex` on `PATH`.
Worktree and dispatch contracts live in `.claude/scripts/dispatch-codex-lane.sh` and
`.claude/skills/plan/teams.md`. Dispatch does not broaden the user's authorization.

## Repo Health Ritual

For ambiguous, multi-issue, cross-package health work only: `/audit` findings → human scope lock →
`/clean` for accepted cleanup-shaped work → `/review` → `/ship`. Do not run this sequence for a
single-file fix, doc-only change, or known-path bug.

## Session Continuity

Before ending or compacting a long execution session, write `session-state.md` only when another
agent needs local continuation state that is not already captured in the owning Plan Hub. Keep it
untracked and delete it when the handoff is no longer needed.
