---
name: git-workflow
description: Git workflow patterns - branching, conventional commits, conflict resolution, release tagging, changelog. Use for branch management, merge conflicts, release workflows.
version: "1.0"
last_updated: "2026-02-08"
last_verified: "2026-02-09"
status: proven
packages: []
dependencies: []
---

# Git Workflow Skill

Git workflow guide: branching strategy, conventional commits, conflict resolution, and release management.

---

## Activation

When invoked:
- Check current branch with `git branch --show-current`.
- Follow conventional commit format for all commits.
- Reference `CLAUDE.md` → Git Workflow section for branch naming rules.

## Part 1: Branch Strategy

### Branch Naming

Use `type/description` format with kebab-case:

| Prefix | Use For | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/hats-protocol-v2` |
| `feat/` | New features (short form) | `feat/passkey-login` |
| `bug/` | Bug fixes | `bug/admin-build-fix` |
| `enhancement/` | Improvements to existing features | `enhancement/celo-deployment` |
| `patch/` | Small fixes, polish | `patch/release-polish` |
| `docs` | Documentation changes | `docs` |

### Rebase vs Merge

| Scenario | Strategy | Why |
|----------|----------|-----|
| Feature branch behind main | Rebase | Clean linear history |
| Long-lived feature branch | Merge | Preserve branch context |
| Shared branch (multiple devs) | Merge | Don't rewrite shared history |
| Personal branch, clean commits | Rebase | Cleaner PR diff |

### Long-Lived Branch Rules

- Rebase onto main at least weekly
- Keep scope tight — split large features into incremental PRs
- Never force-push shared branches

## Part 2: Conventional Commits

### Format

```
type(scope): description

# Types: feat, fix, refactor, chore, docs, test, perf, ci
# Scopes: contracts, indexer, shared, client, admin, agent, claude
```

### Type Reference

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New functionality | `feat(contracts): add Hats Protocol v2 module` |
| `fix` | Bug fixes | `fix(client): resolve offline sync race condition` |
| `refactor` | Code restructuring (no behavior change) | `refactor(shared): extract query key helpers` |
| `chore` | Maintenance, config | `chore: update root config and dependencies` |
| `docs` | Documentation only | `docs(claude): add security skill` |
| `test` | Adding/fixing tests | `test(contracts): add Hats Protocol test suite` |
| `perf` | Performance improvements | `perf(client): lazy load garden detail view` |
| `ci` | CI/CD changes | `ci: add Lighthouse CI workflow` |

### Multi-Package Commits

When a commit spans multiple packages, list scopes:

```
refactor(admin,client): update components for Hats v2
```

### Commit Message Best Practices

- **Subject line**: Imperative mood, < 72 characters, no period
- **Body** (optional): Explain "why" not "what", wrap at 72 characters
- **Footer**: Reference issues (`Fixes #123`), breaking changes (`BREAKING CHANGE:`)
- **Co-authoring**: End with `Co-Authored-By:` when using Claude

## Part 3: Conflict Resolution

### bun.lockb Conflicts

Binary lockfile — ALWAYS regenerate, never manually merge:

```bash
# Accept either side, then regenerate
git checkout --theirs bun.lockb  # or --ours
bun install
git add bun.lockb
```

### Deployment Artifact Conflicts

Take the latest version (artifacts are regenerated on deploy):

```bash
# For packages/contracts/deployments/*.json
git checkout --theirs packages/contracts/deployments/
git add packages/contracts/deployments/
```

### Solidity ABI Conflicts

Rebuild from source — never manually merge ABI JSON:

```bash
cd packages/contracts
bun build  # Regenerates ABIs
git add out/
```

### TypeScript/Source Conflicts

For actual code conflicts:

1. Read both versions carefully
2. Understand the intent of each change
3. Merge manually, preserving both intents
4. Run `bun build` to verify
5. Run `bun test` to verify behavior

## Part 4: Release Workflow

### Tag Format

```
v{major}.{minor}.{patch}    # Production releases
v{major}.{minor}.{patch}-rc.{n}  # Release candidates
```

### Pre-Release Validation Checklist

- [ ] All tests passing: `bun test`
- [ ] Lint clean: `bun lint`
- [ ] Build succeeds: `bun build`
- [ ] Format clean: `bun format --check`
- [ ] No hardcoded addresses
- [ ] Environment variables documented
- [ ] Migration notes written (if breaking changes)

### Changelog Generation

Generate from conventional commits since last tag:

```bash
# List commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Group by type for changelog
git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"%s" | sort
```

## Part 5: PR Best Practices

### Size Guidelines

| Size | LOC Changed | Review Time | Recommendation |
|------|-------------|-------------|----------------|
| Small | < 100 | < 30 min | Ideal |
| Medium | 100-400 | 30-60 min | Good |
| Large | 400-800 | 1-2 hours | Split if possible |
| XL | > 800 | > 2 hours | Must split |

### PR Description Template

```markdown
## Summary
- [1-3 bullet points explaining what and why]

## Changes
- [List of significant changes]

## Test plan
- [ ] Unit tests pass
- [ ] Manual verification of [specific flow]
- [ ] Build succeeds across all packages
```

### Review Readiness

Before requesting review:
1. Run `/review` skill (6-pass review)
2. Full validation: `bun format && bun lint && bun test && bun build`
3. Self-review the diff once
4. PR description filled out

## Anti-Patterns

- **Never force push shared branches** — rewrites history others depend on
- **Never mix concerns in commits** — one logical change per commit
- **Never create PRs > 800 LOC** — split into incremental PRs
- **Never merge without CI passing** — required status checks exist for a reason
- **Never commit secrets** — check for .env, credentials, API keys
- **Never amend published commits** — creates divergent history

## Decision Tree

```
What git operation?
│
├── Creating a branch? ──────────► Part 1: Branch Strategy
│                                   → type/description naming
│                                   → Rebase vs merge decision
│
├── Writing a commit? ───────────► Part 2: Conventional Commits
│                                   → type(scope): description
│                                   → Check type reference
│
├── Resolving conflicts? ────────► Part 3: Conflict Resolution
│                                   → Binary files: regenerate
│                                   → Source files: manual merge
│
├── Preparing a release? ────────► Part 4: Release Workflow
│                                   → Pre-release checklist
│                                   → Tag and changelog
│
└── Creating a PR? ──────────────► Part 5: PR Best Practices
                                    → Size check, /review first
```

## Related Skills

- `ci-cd` — Pipeline configuration that validates git workflow (see ci-cd skill for GitHub Actions patterns)
- `deployment` — Release deployment after tagging
- `review` — 6-pass code review before merge
