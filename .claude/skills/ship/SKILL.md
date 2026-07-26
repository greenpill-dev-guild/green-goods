---
name: ship
user-invocable: false
description: Pre-merge gate — validates the branch is safe to push/merge. Format + lint + test + build + conventional-commit + branch safety + vocab/design-token lint when applicable. Absorbs verification-before-completion and finishing-a-development-branch — evidence before claims, always.
argument-hint: "[--dry-run] [--no-commit] [--pr]"
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

Do not activate this skill for "QA mode", "quick fix", "get this to staging", or
similar requests unless the user also asks to commit, open a PR, merge, release,
or prove the branch is ready. Those requests use QA Speed Mode from `CLAUDE.md`.

---

## Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If the full Ship Gate ([`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md)) didn't run cleanly in this invocation, do not say the branch is ready. "Should", "probably", a green run from an hour ago, or "just the lint was enough" do not count — caches go stale, tests get flaky, and lint ≠ compile ≠ test.

This iron law applies to ship/PR/commit/merge/release readiness claims. It does
not require every narrow QA-speed fix to run the full pipeline before handoff;
QA-speed handoffs must clearly say which targeted proof ran and must not claim
the branch is ready to ship.

---

## Pipeline

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

**Linear linkage check** (note, do not abort):
- If branch matches `<user>/<team-key>-<id>-<slug>` (e.g., `afo/prd-370-...`, `afo/resr-3-...`), Linear's GitHub integration will auto-link the PR to the Issue and auto-transition status (Backlog → In Progress on PR open, → Done on merge). No manual linking needed.
- If the branch does NOT match the convention (e.g., `chore/...`, `codex/...`, `fix/...`), Linear will surface the PR but will not auto-link to an Issue. In PR-creation mode, prompt the user for the related Linear ID and include `Refs PRD-NNN` (or `Refs RESR-NNN`) on its own line in the PR body — Linear's mention-detection picks it up.
- If the user declines a Linear ID for a non-matching branch, accept and proceed — some branches (chore, dependabot, infra) legitimately have no Linear Issue.

### 2. Validation gate

Run the **Ship Gate** exactly as defined in
[`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md) — the core
pipeline plus every conditional addition matching the touched surfaces. That file is the single
definition of the gate commands; never restate or improvise stages here.

Ship-specific handling on top of the shared definition:

- Run stages in the file's order; stop at the first FAIL and report exit code plus the last
  relevant lines of output per stage.
- If `bun format` modifies files, stage the modifications automatically (`git add -u` for
  files already tracked and modified) and re-run the stage.
- Gather touched paths with `git diff --name-only origin/main...HEAD` plus
  `git diff --name-only --cached` to decide which conditional additions apply.

### 3. Commit-message check (if commits exist ahead of main)

```bash
git log origin/main..HEAD --format='%s'
```

Each subject line must match conventional commits with a Green Goods scope:
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`
- Scopes: `contracts`, `indexer`, `shared`, `client`, `admin`, `agent`
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
| Auto-push to main/master | Hard blocker — refuse |
| Force-push anywhere without explicit user permission | Destructive action — confirm first |
| Commit `.env`, credentials, or binaries > 5MB | Safety check — refuse |
| Amend commits not authored in this branch | Destroys prior-author attribution |
| Treat "get this to QA/staging" as ship readiness | QA Speed Mode uses targeted proof; ship runs only for explicit commit/PR/merge/release readiness |
| Turn every ship check into a PR | Not all work needs a PR; match scope to request |

---

## Related Surfaces

- `CLAUDE.md § Git Workflow` — branch strategy and commit conventions
- `.claude/context/validation-pipeline.md` — the single definition of the gate commands
- `review` — pre-merge code review that complements the ship flow
- `.claude/context/testing.md` — test discipline referenced by the pipeline
- `clean` — large-scale cleanup before shipping big diffs
