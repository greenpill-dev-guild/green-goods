---
name: status
user-invocable: true
description: Session resumption and quick orientation for Green Goods. Use when starting work, returning to a branch, or needing a fast lay of the land. Focus on branch state, working tree, continuity artifacts, blockers, recent deltas, and the next 1-3 moves. Not an audit or dashboard.
argument-hint: "[--quick|--resume]"
version: "2.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-04-18"
last_verified: "2026-04-18"
---

# Status Skill

Read-only context reset for Green Goods.

This skill exists to answer:

- what branch or workstream am I in?
- what changed since I last touched it?
- what is blocked right now?
- what should I do next?

## Activation

Use when:

- starting a work session and you need orientation fast
- returning to a branch and you want continuity before touching code
- you want the next 1-3 moves, not a repo-wide dashboard

This is not an audit, architecture review, or morning report.

## Invocation

```text
/status           # standard orientation
/status --quick   # minimal branch/worktree/blockers/next
/status --resume  # branch-scoped continuity pass
```

`/status` should stay fast and branch-first. If `--resume` is requested on `main`, `master`, or `develop`, say so and fall back to standard orientation.

## Execution Model

- **Read-only**: never edit files
- **Fast**: do not run the full test suite
- **Branch-first**: start from git state before reading broad repo surfaces
- **Continuity-first**: prefer `session-state.md`, matching plans, and recent commits over wide scans
- **No subagents by default**: use direct reads and commands only

### Time Budget

| Mode | Target | Intent |
|------|--------|--------|
| `--quick` | 15-30s | branch, worktree, blockers, next |
| default | 30-60s | quick plus continuity artifacts and lightweight health pulse |
| `--resume` | 30-45s | branch-scoped continuity, last activity, next moves |

If one check stalls, report what you have and mark the missing part as not gathered.

## Gather

Always gather the smallest high-signal set:

1. current branch: `git rev-parse --abbrev-ref HEAD`
2. working tree: `git status --short` and `git diff --stat`
3. recent branch activity: `git log --oneline origin/main..HEAD` and `git log -1 --format='%ar by %an: %s' HEAD`
4. continuity artifacts:
   - `session-state.md` if present
   - matching feature hub from branch slug if present
5. blockers:
   - obvious failing continuity artifacts
   - blocked lanes in matching `status.json`
   - lightweight health pulse on touched packages only when it is cheap enough

Prefer touched-package type checks over repo-wide validation. Do not turn `status` into `review`, `audit`, or `ship`.

## Output Contract

Keep the output scannable. Use short bullets and tables where helpful.

### Required Order

1. **Headline** — one sentence on the current work state
2. **Current Branch** — branch, recent activity, commit distance
3. **Working Tree** — modified files, untracked files, diff size
4. **Continuity** — session state, matching plan, or "no continuity artifacts found"
5. **Blockers** — only if something is actually blocking progress
6. **Next 1-3 Moves** — concrete next actions, not generic advice
7. **Delta** — optional, only when there is a meaningful since-last-time change to call out

### Example Shape

```markdown
# Status — feature/example

> **Branch active, continuity artifacts present, next move is to finish the shared type pass before review.**

## Current Branch
- `feature/example`
- Last activity: 2h ago by A. Foo — `refactor(shared): tighten example types`
- Ahead of `origin/main`: 3 commits

## Working Tree
- Modified: 4 files
- Untracked: 1 file
- Diff: +132 / -41

## Continuity
- Session state: present
- Matching plan: `.plans/active/example/plan.todo.md`
- Next unchecked item: tighten shared exports

## Blockers
- `shared` typecheck failing in touched package

## Next
1. Fix the touched-package type error in `shared`
2. Re-run the narrow validation needed for the branch
3. Move to `/review` once the diff is stable
```

## Mode Notes

### default

Use this as the normal orientation pass. It should be enough for most sessions.

### `--quick`

Skip continuity deep reads unless they are immediately available. Focus on branch, worktree, blockers, and next moves.

### `--resume`

Bias hard toward branch-scoped continuity:

- matching plan from branch slug
- `session-state.md`
- recent branch commits
- touched-package health only

This mode is for "what was I doing here?" not "what is the whole repo doing?"

## Escalation

If `status` shows uncertainty, route to the right next verb:

- describe the planning intent ("plan this", "break down X") when the next move is not yet shaped
- describe the bug or paste the error when the branch is blocked by a failing symptom
- use `/review` when the branch mostly needs judgment on the current diff

Do not jump to broader repo-health or architecture work unless the evidence actually points there.

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Turn `status` into a full morning dashboard | Too much surface, not enough decision value |
| Run the full test suite | This is orientation, not merge validation |
| Scan the whole repo by default | Branch and continuity context usually matter more |
| Make architecture or principles judgments | Those belong inside `plan` or `review` when needed |
| Report a giant inventory of files or exports | The goal is next action, not exhaustive listing |
| Edit files | Read-only, always |

## Related Skills

- `plan` — when orientation reveals work that still needs shaping
- `debug` — when orientation reveals a concrete failure or blocker to investigate
- `review` — when orientation reveals a diff ready for judgment
- `ship` — passive finishing flow once the branch is actually ready to validate
