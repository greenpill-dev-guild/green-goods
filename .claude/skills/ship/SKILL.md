---
name: ship
user-invocable: false
description: Pre-merge gate — validates the branch is safe to push/merge. Format + lint + test + build + conventional-commit + branch safety + vocab/design-token lint when applicable. Absorbs verification-before-completion and finishing-a-development-branch — evidence before claims, always.
argument-hint: "[--dry-run] [--no-commit] [--pr]"
version: "1.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-04-17"
last_verified: "2026-04-17"
---

# Ship Skill

Pre-merge gate for Green Goods. Validates that the current branch is safe to push, merge, or turn into a PR.

**Core principle**: evidence before claims. If the validation command didn't run in this invocation, you cannot claim it passes.

---

## Activation

| Trigger | Action |
|---------|--------|
| "ready to ship" | Full validation + guided commit/push/PR |
| "dry-run ship check" | Validation only, no commit/push |
| "stage but don't commit" | Validate + stage applicable files, stop before commit |
| "open a PR" | Validate + create PR via `gh pr create` |

---

## Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If `bun format && bun lint && bun run test && bun build` didn't run cleanly in this invocation, do not say the branch is ready.

Red flags that mean STOP:
- Using "should", "probably", "seems to" about validation state
- Expressing satisfaction before the full pipeline exits 0
- Trusting a prior run — caches go stale, tests get flaky
- "Just the lint was enough" — lint ≠ compile ≠ test

---

## Pipeline

Run in this order. Stop at first FAIL (except where noted). Report exit code and last 5 lines of output for each stage.

### 1. Pre-flight safety

Before running any validation, confirm the branch is safe to ship:

```bash
git rev-parse --abbrev-ref HEAD              # Not main/master/develop
git status --short                            # Know what's staged vs modified
git log --oneline origin/main..HEAD -20       # Commits diverging from main
git diff --stat origin/main...HEAD | tail -5  # Size of the change
```

**Abort conditions:**
- On `main`, `master`, or `develop` → refuse, tell user to branch first
- Unstaged changes to `.env`, `*.env.*`, or files matching `credentials*`, `*.pem`, `*.key` → refuse, flag
- Staged file larger than 5MB → warn, ask user to confirm (likely unintended binary)
- No commits ahead of `origin/main` and no staged changes → nothing to ship; exit

### 2. Format

```bash
bun format 2>&1 | tail -5
```

If the formatter modifies files, stage the modifications automatically (`git add -u` for files already tracked and modified). Re-run if needed.

### 3. Lint

```bash
bun lint 2>&1 | tail -10
```

Exit code 0 = PASS. Non-zero = FAIL. Never proceed on FAIL.

### 4. Tests

```bash
bun run test 2>&1 | tail -20
```

**CRITICAL**: Use `bun run test` (vitest via package.json), NEVER `bun test` (bun's built-in runner ignores vitest config). The project hook blocks `bun test`, but double-check.

Report: N passing / N failing / N skipped. Any failure = abort.

### 5. Build

```bash
bun build 2>&1 | tail -15
```

Respects the monorepo dependency order (contracts → shared → indexer → client/admin/agent). Any non-zero exit = abort.

### 6. Scope-specific lints (conditional)

Run these only if the changed files match:

| Condition | Command |
|-----------|---------|
| Changed files under `packages/shared/src/styles/theme.css` or `.claude/skills/design/language.md` | `bun run check:design-tokens` |
| Changed files include `*.i18n.ts`, `packages/*/locales/*.json`, or `packages/admin/src/**` or `packages/client/src/**` | `bun run lint:vocab` |
| Changed files under `packages/contracts/src/resolvers/` | Check storage gap via existing PostToolUse hook output |
| Changed files under `packages/contracts/src/` | Remind to run `bun run test:fork` if protocol behavior changed |

Gather touched paths with `git diff --name-only origin/main...HEAD` + `git diff --name-only --cached`.

### 7. Commit-message check (if commits exist ahead of main)

```bash
git log origin/main..HEAD --format='%s'
```

Each subject line must match conventional commits with a Green Goods scope:
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`
- Scopes: `contracts`, `indexer`, `shared`, `client`, `admin`, `agent`, `claude`
- Format: `type(scope): description` or `type(scope,scope): description`

Flag any that don't match. Offer to amend via `git commit --amend` (only if the offending commit is the HEAD commit; for earlier commits, suggest a rebase but don't auto-run it).

---

## Decision tree after validation passes

```
Is work staged or committed?
├─ Nothing staged, no commits → "Nothing to ship" — exit.
├─ Staged but uncommitted → Offer to commit (--no-commit skips this).
└─ Commits ahead of origin/main → Push or PR branch.

Are you pushing or opening a PR?
├─ --pr flag → gh pr create (use the PR creation flow from CLAUDE.md)
├─ Commits on a non-main branch + tracked remote → git push (confirm first)
├─ Commits on a branch with no remote → offer git push -u origin <branch>
└─ Default: ask — push, PR, or hold?
```

### Commit-creation mode

If the user accepts committing, follow the `Committing changes with git` rules from the system prompt:
- Parallel `git status` + `git diff` + `git log` for context
- Draft conventional-commit message with Green Goods scope
- Never commit `.env`, credentials, or large binaries
- HEREDOC the commit body
- Verify success with `git status` after

### PR-creation mode

If `--pr` is set (or the user picks PR):
- Follow the `Creating pull requests` rules from the system prompt
- Use `gh pr create` with a short title + HEREDOC body
- Include a Test Plan checklist
- Return the PR URL

---

## Output format

Use this exact shape. Tables and short sentences — no prose.

```markdown
# Ship Report — <branch-name>

## Pre-flight
- Branch: feature/foo (not main ✓)
- Staged: N files | Modified: N | Untracked: N (ignored)
- Commits ahead of origin/main: N
- Diff size: +X / -Y lines

## Pipeline
| Stage | Status | Detail |
|-------|--------|--------|
| Format | PASS | 0 files modified |
| Lint | PASS | 2 warnings, 0 errors |
| Tests | PASS | 47/47 |
| Build | PASS | all 6 packages |
| Design tokens | N/A | no token changes |
| Vocab lint | PASS | 0 violations |

## Commits
| Subject | Status |
|---------|--------|
| feat(client): add deposit dialog | ✓ valid |
| fix: typo | ✗ missing scope |

## Next
- Amend HEAD commit: `git commit --amend -m "fix(client): typo"`
- Then: push / PR / hold?
```

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Claim "ready to ship" without running the pipeline this invocation | Violates the iron law |
| Skip stages because "they were green an hour ago" | Caches and state change |
| Run `bun test` instead of `bun run test` | Bypasses vitest config; hook blocks but double-check |
| Auto-push to main/master | Hard blocker — refuse |
| Commit `.env`, credentials, or binaries > 5MB | Safety check — refuse |
| Force-push anywhere without explicit user permission | Destructive action — confirm first |
| Amend commits not authored in this branch | Destroys prior-author attribution |
| Turn every ship check into a PR | Not all work needs a PR; match scope to request |

---

## Related Skills

- `ops/git-workflow` — branch strategy and commit conventions
- `ops/ci-cd` — what CI runs after push
- `review` — pre-merge code review that complements the ship flow
- `testing` — test discipline referenced by the pipeline
- `clean` — large-scale cleanup before shipping big diffs

---

## Key principles

- **Evidence before claims** — no shortcuts
- **Fail fast** — stop at the first failing stage, don't run downstream
- **Scope-aware** — only run design-tokens / vocab / contracts-fork where applicable
- **Match action to request** — use the ship flow for validation, `--pr` for PR, `--dry-run` when exploring
- **Refuse unsafe operations** — branching onto main, secrets in diff, force-push to main
