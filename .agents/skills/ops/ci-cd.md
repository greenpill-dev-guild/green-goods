# CI/CD Patterns (ops sub-file)

> Deep reference for the [ops skill](./SKILL.md).

---

## Pipeline Architecture

### Existing Workflows (11)

| Workflow | Trigger | Packages | Purpose |
|----------|---------|----------|---------|
| `admin-tests.yml` | PR, push | admin | Admin package tests |
| `agent-tests.yml` | PR, push | agent | Agent package tests |
| `client-tests.yml` | PR, push | client | Client package tests |
| `contracts-tests.yml` | PR, push | contracts | Forge tests |
| `indexer-tests.yml` | PR, push | indexer | Indexer tests |
| `shared-tests.yml` | PR, push | shared | Shared package tests |
| `e2e-tests.yml` | PR, push | client | Playwright E2E tests |
| `lighthouse-ci.yml` | PR | client | Performance budgets |
| `deploy-docs.yml` | Push to main | docs | Documentation site |
| `deploy-ipfs.yml` | Manual | client | IPFS pinning |
| `upload-sourcemaps.yml` | Push to main | client, admin | Error tracking |

### Path-Filtering Pattern

Each workflow only runs when relevant files change:

```yaml
on:
  pull_request:
    paths:
      - 'packages/shared/**'
      - 'packages/client/**'
      - 'bun.lockb'
  push:
    branches: [main]
    paths:
      - 'packages/shared/**'
      - 'packages/client/**'
```

**Key**: Client and admin workflows also trigger on `packages/shared/**` changes since they depend on shared.

### Concurrency Groups

Prevent redundant runs on rapid pushes:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## Workflow Patterns

### Standard Job Structure

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.5.0" # Pin for reproducible CI

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build dependencies
        run: bun --filter shared build

      - name: Run tests
        run: bun --filter client test

      - name: Build
        run: bun --filter client build
```

### Dependency Build Order in CI

```yaml
# When testing client or admin, build shared first
- name: Build shared (dependency)
  run: bun --filter shared build

# When testing shared, build contracts first (for ABIs)
- name: Build contracts (dependency)
  run: bun --filter contracts build
```

### Artifact Passing Between Jobs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: bun build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: packages/client/dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
```

---

## Caching Strategy

### Bun Cache

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: bun-${{ runner.os }}-${{ hashFiles('bun.lockb') }}
    restore-keys: |
      bun-${{ runner.os }}-
```

### Foundry Cache

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.foundry/cache
      packages/contracts/cache
      packages/contracts/out
    key: foundry-${{ runner.os }}-${{ hashFiles('packages/contracts/foundry.toml') }}
```

### What NOT to Cache

- `node_modules/` -- Bun recreates from cache faster than restoring
- Build artifacts that depend on env vars -- stale builds cause subtle bugs
- Lockfiles -- always use `--frozen-lockfile`

---

## PR Status Gates

### Required Checks

| Check | Blocks Merge | Why |
|-------|-------------|-----|
| Package tests | Yes | Prevents regressions |
| Build | Yes | Ensures deployability |
| Lint | Yes | Code consistency |
| E2E tests | No (advisory) | Flaky tests shouldn't block |
| Lighthouse | No (advisory) | Performance awareness |

### Branch Protection

```text
Settings -> Branches -> Branch protection rules:
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require linear history (rebase merging)
```

---

## Secrets Management

### Naming Convention

```text
VITE_*              -- Build-time env vars (exposed to client)
PRIVATE_*           -- Server-side only secrets
DEPLOY_*            -- Deployment credentials
```

### Environment-Specific Secrets

| Secret | Environment | Purpose |
|--------|-------------|---------|
| `VITE_CHAIN_ID` | Per-environment | Target blockchain |
| `DEPLOY_VERCEL_TOKEN` | Production | Vercel deployment |
| `PRIVATE_DEPLOYER_KEY` | Production | Contract deployment |

### Security Rules

- Never echo secrets in workflow logs
- Use `environment` protection rules for production secrets
- Rotate secrets on team member departure
- Use OIDC tokens where possible (no long-lived secrets)

---

## Local CI Simulation

### Pre-Commit Validation

Run the same checks locally before pushing:

```bash
# Full validation (same as CI)
bun format && bun lint && bun run test && bun build

# Quick check (just the essentials)
bun lint && bun run test
```

### Husky Hooks

```bash
# .husky/pre-commit
bun lint-staged

# .husky/pre-push
bun run test && bun build
```

### Simulating CI Locally

```bash
# Test exactly what CI will test for a specific package
bun --filter shared build && bun --filter client test && bun --filter client build

# Run with frozen lockfile (catches dependency drift)
bun install --frozen-lockfile
```

---

## Anti-Patterns

- **Never run all tests without path filters** -- wastes CI minutes on unchanged packages
- **Never skip `--frozen-lockfile`** -- causes "works on my machine" drift
- **Never cache `node_modules/`** -- Bun's own cache is faster and more reliable
- **Never hardcode secrets in workflow files** -- use GitHub Secrets
- **Never ignore flaky tests** -- fix or quarantine them, don't disable
- **Never skip dependency build order** -- shared must build before client/admin

---

## Decision Tree

```text
What CI/CD work?
|
+--> New workflow? -----------------> Pipeline Architecture (above)
|                                      -> Follow path-filtering pattern
|                                      -> Add concurrency group
|
+--> Workflow optimization? --------> Caching Strategy (above)
|                                      -> Cache Bun + Foundry
|                                      -> Avoid caching node_modules
|
+--> PR not passing checks? -------> PR Status Gates (above)
|                                      -> Check which gate failed
|                                      -> Run locally to reproduce
|
+--> Adding secrets? --------------> Secrets Management (above)
|                                      -> Follow naming convention
|                                      -> Use environment protection
|
+--> Testing CI locally? ----------> Local CI Simulation (above)
                                       -> bun format && bun lint && bun run test && bun build
```
