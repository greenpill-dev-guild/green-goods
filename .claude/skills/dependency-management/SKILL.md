---
name: dependency-management
description: Monorepo dependency management - workspace protocol, lockfile conflicts, audit/update workflows, phantom dependencies. Use for dependency upgrades, lockfile issues, workspace management.
version: "1.0"
last_updated: "2026-02-08"
last_verified: "2026-02-09"
status: established
packages: []
dependencies: []
---

# Dependency Management Skill

Bun monorepo dependency guide: workspace protocol, lockfile handling, update workflows, and security auditing.

> **Documentation sync required:** If dependency behavior or commands change here, update the linked references in Getting Started, Contributing, and package READMEs in the same PR.
>
> Referenced from: Getting Started, Contributing, Package READMEs.

---

## Activation

When invoked:
- Check `package.json` files in root and all packages for current dependency state.
- Review `bun.lockb` status — binary format, always regenerate on conflict.
- Check for the `postinstall` script (fix-multiformats.js) that patches known issues.

## Part 1: Bun Workspace Protocol

### Workspace Configuration

```json
// Root package.json
{
  "workspaces": [
    "packages/*"
  ]
}
```

### Internal Dependencies

```json
// packages/client/package.json
{
  "dependencies": {
    "@green-goods/shared": "workspace:*"
  }
}
```

| Specifier | Meaning | When to Use |
|-----------|---------|-------------|
| `workspace:*` | Latest version in workspace | Always for internal deps |
| `workspace:^1.0.0` | Compatible version range | Never — use `*` |

### Peer Dependencies

```json
// packages/shared/package.json
{
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Peer deps are NOT auto-installed — the consuming package (client/admin) must include them.

## Part 2: Dependency Categories

### Production vs Dev

| Category | Where | Example |
|----------|-------|---------|
| `dependencies` | Runtime code | react, wagmi, viem |
| `devDependencies` | Build/test only | vitest, typescript, @types/* |
| `peerDependencies` | Provided by consumer | react (in shared) |

### Package-Specific Patterns

| Package | Key Dependencies | Notes |
|---------|-----------------|-------|
| contracts | forge-std, openzeppelin | Installed via forge, not bun |
| shared | react, wagmi, viem, zustand | Peer deps for react |
| client/admin | @green-goods/shared | workspace:* |
| indexer | @envio-dev/hyperindex | Specific version required |
| agent | grammy, hono | Platform-specific |

## Part 3: Update Workflow

### Safe Update Process

```bash
# 1. Check for outdated packages
bun outdated

# 2. Update a specific package
bun update wagmi

# 3. Update all (within semver ranges)
bun update

# 4. Validate after update
bun install --frozen-lockfile  # Should work
bun build                      # Build all packages
bun test                       # Run all tests
```

### The fix-multiformats.js Script

```bash
# Root postinstall script patches a known issue
# with the multiformats package (CID encoding)
"postinstall": "node scripts/fix-multiformats.js"
```

This runs automatically on `bun install`. Never remove it without verifying the upstream fix.

### Breaking Change Detection

When updating major versions:

1. Read the changelog/migration guide
2. Search for breaking API changes: `grep -rn "oldApiName" packages/`
3. Update one package at a time
4. Build and test after each update
5. Use the `migration` skill for cross-package upgrades

## Part 4: Lockfile Management

### bun.lockb Binary Format

Unlike `package-lock.json`, `bun.lockb` is binary and cannot be manually edited or merged.

### Conflict Resolution

```bash
# ALWAYS regenerate — never manually merge
git checkout --theirs bun.lockb  # Accept either side
bun install                       # Regenerate from package.json files
git add bun.lockb
```

### CI Validation

```bash
# Ensure lockfile matches package.json (catches drift)
bun install --frozen-lockfile
```

If `--frozen-lockfile` fails in CI, someone forgot to commit the updated lockfile after changing `package.json`.

## Part 5: Phantom Dependencies

### What They Are

A phantom dependency is a package your code imports but doesn't declare in `package.json`. It works locally because another package installed it, but can fail in CI or on other machines.

### Detection

```bash
# Check for imports not in package.json
# Match non-relative imports from real import/export statements (skip comments and local paths)
rg -nP "^(?:import|export)\\s.+from\\s+['\"](?!\\.?/)(?!@green-goods/)[^'\"]+['\"]" \
  packages/shared/src \
  --glob '!**/node_modules/**'
```

### Fixing

```bash
# Add the missing dependency to the correct package
cd packages/shared
bun add missing-package
```

## Part 6: Security Audit

### Vulnerability Scanning

```bash
# Check for known vulnerabilities
bun audit

# Or use npm audit (more comprehensive database)
npm audit
```

### Patch Strategies

| Severity | Strategy |
|----------|----------|
| Critical | Patch immediately, even if it means pinning |
| High | Patch within 1 week |
| Medium | Patch in next release cycle |
| Low | Track, patch opportunistically |

### Override Vulnerable Transitive Dependencies

```json
// Root package.json
{
  "overrides": {
    "vulnerable-package": ">=2.0.1"
  }
}
```

## Part 7: Version Pinning

### When to Pin Exact Versions

| Package | Strategy | Why |
|---------|----------|-----|
| wagmi | Pin exact | Breaking changes between minors |
| viem | Pin exact | Must match wagmi version |
| react | Pin exact | Major version matters |
| vitest | Range `^` | Dev dependency, less risk |
| typescript | Range `~` | Patch updates safe |
| @types/* | Range `^` | Usually safe |

### Pinning Syntax

```json
{
  "dependencies": {
    "wagmi": "2.14.11",      // Exact — no prefix
    "react": "^19.0.0",      // Compatible — minor updates OK
    "typescript": "~5.7.0"   // Patch — only patch updates
  }
}
```

## Anti-Patterns

- **Never install root deps for package-specific needs** — install in the correct package
- **Never skip `--frozen-lockfile` in CI** — allows dependency drift
- **Never update all deps at once without testing** — isolate changes
- **Never manually edit bun.lockb** — always regenerate
- **Never ignore postinstall scripts** — they fix known issues
- **Never use `latest` as version specifier** — unpredictable builds

## Decision Tree

```text
What dependency work?
│
├── Adding a dependency? ────────► Part 1: Workspace Protocol
│                                   → workspace:* for internal
│                                   → Check peerDependencies
│
├── Updating dependencies? ─────► Part 3: Update Workflow
│                                   → Check breaking changes
│                                   → Build + test after update
│
├── Lockfile conflict? ──────────► Part 4: Lockfile Management
│                                   → Always regenerate bun.lockb
│                                   → Never manually merge
│
├── CI install failure? ─────────► Part 4 + Part 5
│                                   → --frozen-lockfile check
│                                   → Phantom dependency check
│
├── Security vulnerability? ────► Part 6: Security Audit
│                                   → bun audit
│                                   → Override if transitive
│
└── Version strategy? ──────────► Part 7: Version Pinning
                                    → Pin wagmi/viem/react exact
                                    → Range for dev dependencies
```

## Related Skills

- `migration` — Cross-package dependency upgrades with breaking changes
- `ci-cd` — CI validation with `--frozen-lockfile`
- `vite` — Build tool configuration affected by dependency changes
