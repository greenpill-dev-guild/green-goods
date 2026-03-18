# Dependency Management (ops sub-file)

> Deep reference for the [ops skill](./SKILL.md). Covers Bun workspace protocol, lockfile handling, update workflow, phantom dependencies, security audit, and version pinning.

> **Documentation sync required:** If dependency behavior or commands change here, update the linked references in Getting Started, Contributing, and package READMEs in the same PR.
>
> Referenced from: Getting Started, Contributing, Package READMEs.

---

## Bun Workspace Protocol

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
| `workspace:^1.0.0` | Compatible version range | Never -- use `*` |

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

Peer deps are NOT auto-installed -- the consuming package (client/admin) must include them.

---

## Dependency Categories

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

---

## Update Workflow

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
bun run test                   # Run all tests
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

---

## Lockfile Management

### bun.lockb Binary Format

Unlike `package-lock.json`, `bun.lockb` is binary and cannot be manually edited or merged.

### Conflict Resolution

```bash
# ALWAYS regenerate -- never manually merge
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

---

## Phantom Dependencies

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

---

## Security Audit

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

---

## Version Pinning

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
    "wagmi": "2.14.11",      // Exact -- no prefix
    "react": "^19.0.0",      // Compatible -- minor updates OK
    "typescript": "~5.7.0"   // Patch -- only patch updates
  }
}
```
