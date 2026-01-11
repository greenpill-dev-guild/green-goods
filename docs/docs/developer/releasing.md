# Release Process

This guide covers the complete release process for Green Goods, from version bumping to GitHub releases.

---

## Overview

Green Goods uses [Semantic Versioning](https://semver.org/) (SemVer) for all packages:

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

All workspace packages share the same version number to simplify dependency management.

---

## Pre-Release Checklist

Before starting a release, ensure:

- [ ] All CI checks pass on the branch
- [ ] Tests pass locally: `bun test`
- [ ] Linting is clean: `bun lint`
- [ ] Formatting is correct: `bun format:check`
- [ ] Documentation is up to date
- [ ] No unresolved security vulnerabilities
- [ ] Contracts are verified (if changed)

```bash
# Quick validation
bun format && bun lint && bun test
```

---

## Step 1: Update Version Numbers

### All Package.json Files

Update the `version` field in all 8 package.json files:

| Package | Path |
|---------|------|
| Root | `package.json` |
| Shared | `packages/shared/package.json` |
| Client | `packages/client/package.json` |
| Admin | `packages/admin/package.json` |
| Agent | `packages/agent/package.json` |
| Indexer | `packages/indexer/package.json` |
| Contracts | `packages/contracts/package.json` |
| Docs | `docs/package.json` |

```bash
# Example: Update all to 0.5.0
# Use your editor or a script to update all files
```

### Package Names

Ensure all packages use the `@green-goods/` scope:

```json
{
  "name": "@green-goods/client",
  "version": "0.5.0"
}
```

---

## Step 2: Update CHANGELOG.md

Add a new section at the top of `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [0.5.0] - YYYY-MM-DD

### Added
- New features...

### Changed
- Modified behaviors...

### Fixed
- Bug fixes...

### Removed
- Deprecated features removed...

### Security
- Security patches...
```

### Categories to Include

| Category | Description |
|----------|-------------|
| **Added** | New features |
| **Changed** | Changes in existing functionality |
| **Deprecated** | Soon-to-be removed features |
| **Removed** | Now removed features |
| **Fixed** | Bug fixes |
| **Security** | Vulnerability patches |

### Tips for Good Release Notes

1. **Be specific**: "Fixed work submission timeout on slow networks" > "Fixed bug"
2. **Link issues**: Reference GitHub issues `(#123)`
3. **Group by package**: Organize changes by affected package
4. **Highlight breaking changes**: Put them at the top with migration steps

---

## Step 3: Update Documentation Changelog

Update `docs/docs/reference/changelog.md` with user-facing changes:

```markdown
### vX.Y.Z - Month YYYY

**Features:**
- ✅ Feature description

**Improvements:**
- ✅ Improvement description

**Bug Fixes:**
- ✅ Fix description
```

---

## Step 4: Commit the Release

Use a conventional commit message:

```bash
git add -A

git commit -m "$(cat <<'EOF'
chore(release): bump version to 0.5.0

- Update all package.json files to version 0.5.0
- Add CHANGELOG.md entry for v0.5.0
- Update documentation changelog

EOF
)"
```

---

## Step 5: Create an Annotated Tag

**Always use annotated tags** (not lightweight) for releases:

```bash
git tag -a v0.5.0 -m "$(cat <<'EOF'
Release v0.5.0

Highlights:
- Feature 1
- Feature 2
- Bug fix 1

See CHANGELOG.md for full details.
EOF
)"
```

### Tag Naming Convention

- Format: `vX.Y.Z` (e.g., `v0.5.0`)
- Pre-releases: `vX.Y.Z-alpha.1`, `vX.Y.Z-beta.1`, `vX.Y.Z-rc.1`

---

## Step 6: Push Changes and Tag

```bash
# Push the commit
git push origin HEAD

# Push the tag
git push origin v0.5.0

# Or push all tags
git push origin --tags
```

---

## Step 7: Create GitHub Release

### Option A: Using GitHub CLI

```bash
gh release create v0.5.0 \
  --title "v0.5.0 - Release Title" \
  --notes-file CHANGELOG.md
```

Or with inline notes:

```bash
gh release create v0.5.0 \
  --title "v0.5.0 - Release Title" \
  --notes "$(cat <<'EOF'
## Highlights

- Feature 1
- Feature 2

## Full Changelog

See [CHANGELOG.md](https://github.com/greenpill-dev-guild/green-goods/blob/main/CHANGELOG.md)
EOF
)"
```

### Option B: Using GitHub UI

1. Navigate to **Releases** → **Draft a new release**
2. Select or create tag `v0.5.0`
3. Set release title: `v0.5.0 - Descriptive Title`
4. Copy relevant section from `CHANGELOG.md`
5. Check **Set as the latest release**
6. Click **Publish release**

---

## Step 8: Post-Release Tasks

### Verify Deployments

After release, verify:

- [ ] Vercel deployments succeeded (client, admin, docs)
- [ ] Documentation site updated
- [ ] Contract addresses unchanged (if no contract changes)

### Announce the Release

- [ ] Post to Discord/Telegram
- [ ] Tweet from @greengoodsapp
- [ ] Update any external documentation

### Monitor for Issues

- Watch GitHub issues for regression reports
- Monitor error tracking (PostHog, Sentry)
- Check contract interactions on block explorer

---

## Hotfix Releases

For urgent fixes on a released version:

```bash
# Create hotfix branch from tag
git checkout -b hotfix/0.5.1 v0.5.0

# Make fixes
# ... edit files ...

# Commit with conventional commit
git commit -m "fix(client): resolve critical auth bug (#456)"

# Update version to 0.5.1 in all package.json files
# Update CHANGELOG.md

# Commit version bump
git commit -m "chore(release): bump version to 0.5.1"

# Tag and push
git tag -a v0.5.1 -m "Hotfix: Critical auth bug"
git push origin hotfix/0.5.1
git push origin v0.5.1

# Create PR to merge hotfix back to main
gh pr create --title "Merge hotfix 0.5.1" --base main
```

---

## Pre-Release Versions

For alpha/beta/rc releases:

```bash
# Alpha (early testing)
git tag -a v0.6.0-alpha.1 -m "v0.6.0 Alpha 1"

# Beta (feature complete, bug fixing)
git tag -a v0.6.0-beta.1 -m "v0.6.0 Beta 1"

# Release Candidate (final testing)
git tag -a v0.6.0-rc.1 -m "v0.6.0 Release Candidate 1"
```

GitHub release options:

```bash
# Mark as pre-release
gh release create v0.6.0-alpha.1 \
  --title "v0.6.0 Alpha 1" \
  --prerelease \
  --notes "Early preview of v0.6.0 features"
```

---

## Contract Releases

If the release includes contract changes:

### 1. Verify Contract Deployments

```bash
# Check deployment status
cd packages/contracts
bun run status
```

### 2. Update Contract Addresses

If new deployments were made, update:
- `packages/contracts/deployments/` JSON files
- `packages/shared/src/config/contracts.ts`
- Indexer configuration (if needed)

### 3. Verify on Block Explorer

```bash
# Verify contracts (example for Arbitrum)
bun run deploy:arbitrum --verify
```

### 4. Document Schema Changes

If EAS schemas changed, update:
- `packages/contracts/schemas.json`
- Documentation in `docs/docs/developer/api-reference.md`

---

## Rollback Procedure

If a release has critical issues:

### 1. Immediate Mitigation

```bash
# Revert Vercel to previous deployment (via dashboard)
# Or deploy previous version manually
```

### 2. Git Revert (if needed)

```bash
# Create revert commit
git revert HEAD

# Or revert to specific tag
git checkout v0.4.0

# Tag the revert
git tag -a v0.5.1 -m "Revert to v0.4.0 due to critical issue"
```

### 3. Communicate

- Post incident notice in Discord/Telegram
- Create GitHub issue for tracking
- Update status page (if applicable)

---

## Release Automation (Future)

We plan to implement:

- [ ] `bun run release` script for version bumping
- [ ] Automated changelog generation from commits
- [ ] GitHub Actions release workflow
- [ ] Semantic release integration

---

## Quick Reference

```bash
# Full release flow
bun format && bun lint && bun test         # Validate
# Update all package.json versions
# Update CHANGELOG.md
git add -A
git commit -m "chore(release): bump version to X.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin HEAD
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file CHANGELOG.md
```

---

## See Also

- [Contributing Guide](./contributing.md)
- [Contracts Handbook](./contracts-handbook.md)
- [CHANGELOG.md](https://github.com/greenpill-dev-guild/green-goods/blob/main/CHANGELOG.md)
- [GitHub Releases](https://github.com/greenpill-dev-guild/green-goods/releases)
