# Git Workflow (ops sub-file)

> Deep reference for the [ops skill](./SKILL.md). Covers branching strategy, conventional commits, conflict resolution, release tagging, and PR best practices.

---

## Repository

The canonical repository is `greenpill-dev-guild/green-goods`. There should be a single `origin` remote:

```
origin  git@github.com:greenpill-dev-guild/green-goods.git
```

**Do NOT add `camp-green` as a remote.** The `greenpill-dev-guild/camp-green` repository is **archived** and read-only -- all issues, PRs, and pushes go to `green-goods`. If `gh` CLI commands fail with "Repository was archived", verify your remote with `git remote -v`.

---

## Branch Strategy

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
- Keep scope tight -- split large features into incremental PRs
- Never force-push shared branches

---

## Conventional Commits

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

---

## Conflict Resolution

### bun.lockb Conflicts

Binary lockfile -- ALWAYS regenerate, never manually merge:

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

Rebuild from source -- never manually merge ABI JSON:

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
5. Run `bun run test` to verify behavior

---

## Release Workflow

### Tag Format

```
v{major}.{minor}.{patch}           # Production releases
v{major}.{minor}.{patch}-rc.{n}    # Release candidates
```

### Pre-Release Validation Checklist

- [ ] All tests passing: `bun run test`
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

---

## PR Best Practices

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
2. Full validation: `bun format && bun lint && bun run test && bun build`
3. Self-review the diff once
4. PR description filled out
