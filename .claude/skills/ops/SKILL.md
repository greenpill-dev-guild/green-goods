---
name: ops
description: Operations - deployment pipeline, CI/CD, git workflow, dependency management, code formatting. Use for deploying, CI configuration, git operations, branch strategy, dependency upgrades, formatting, and release management.
version: "1.0.0"
status: active
packages: ["all"]
dependencies: ["contracts"]
last_updated: "2026-03-18"
last_verified: "2026-03-18"
---

# Ops Skill

Unified operations guide covering deployment, CI/CD, git workflow, dependency management, and code formatting for the Green Goods monorepo.

---

## Activation

| Signal | Domain | Sub-File |
|--------|--------|----------|
| Deploy, release, broadcast, mainnet, testnet, Vercel, indexer deploy | Deployment | [deployment.md](./deployment.md) |
| CI, GitHub Actions, workflow, pipeline, caching, status checks | CI/CD | [ci-cd.md](./ci-cd.md) |
| Branch, commit, merge, rebase, PR, release tag, changelog | Git | [git-workflow.md](./git-workflow.md) |
| Dependencies, lockfile, `bun install`, audit, upgrade, workspace | Dependencies | [dependency-management.md](./dependency-management.md) |
| Format, Biome, import sorting, Prettier migration | Formatting | [biome.md](./biome.md) |

---

## Part 1: Quick Reference

### Everyday Commands

```bash
bun format                   # Format workspace (Biome)
bun lint                     # Lint workspace (oxlint + forge fmt)
bun run test                 # Run all tests (CRITICAL: not `bun test`)
bun build                    # Build everything (respects dependency order)
bun dev                      # Start all services via PM2
bun dev:stop                 # Stop all services

# Full validation (run before committing or pushing)
bun format && bun lint && bun run test && bun build
```

### Deployment Commands

```bash
# Contract deployment (ALWAYS use deploy.ts, never forge script)
bun script/deploy.ts core --network sepolia              # Dry run
bun script/deploy.ts core --network sepolia --broadcast  # Deploy
bun script/deploy.ts core --network sepolia --broadcast --update-schemas  # Deploy + schemas

# Production readiness
bun run verify:contracts       # Full: build + lint + tests + E2E + dry runs
bun run verify:contracts:fast  # Quick: skip E2E and dry runs

# Indexer
cd packages/indexer && bun run dev:docker     # Local Docker
docker compose -f docker-compose.indexer.yaml up -d  # Production

# Frontend
cd packages/client && bun build && vercel --prod
cd packages/admin && bun build && vercel --prod
```

### Git Conventions

```bash
# Branch naming: type/description (kebab-case)
feature/hats-protocol-v2    feat/passkey-login    bug/admin-build-fix

# Commit format: type(scope): description
# Types: feat, fix, refactor, chore, docs, test, perf, ci
# Scopes: contracts, indexer, shared, client, admin, agent, claude
feat(contracts): add Hats Protocol v2 module
fix(client): resolve offline sync race condition
```

### Dependency Commands

```bash
bun outdated                    # Check for outdated packages
bun update wagmi                # Update specific package
bun install --frozen-lockfile   # CI validation (catches drift)
bun audit                       # Security vulnerability scan
```

---

## Part 2: Deployment Pipeline

### Deployment Order (MANDATORY)

```
1. contracts  --> Generates ABIs + deployment artifacts
2. indexer    --> Needs contract addresses + ABIs
3. shared     --> Needs contract artifacts (build only, not deployed)
4. client     --> Needs shared + indexer endpoint
5. admin      --> Needs shared + indexer endpoint
```

### Cross-Package Dependency Map

```
contracts --> deployments/{chainId}-latest.json --> shared (ABIs)
                                                 \-> indexer (addresses)
shared --> hooks, types, utils --> client
                                \-> admin
indexer --> GraphQL endpoint --> client (queries)
                             \-> admin (queries)
```

### deploy.ts CLI

| Command | Purpose |
|---------|---------|
| `bun script/deploy.ts core --network <net>` | Deploy core contracts |
| `bun script/deploy.ts garden <config.json> --network <net>` | Deploy garden config |
| `bun script/deploy.ts hats-tree --network <net>` | Deploy Hats Protocol tree |
| `bun script/deploy.ts status [network]` | Check deployment status |

| Flag | Purpose |
|------|---------|
| `--network` | Target chain (localhost, baseSepolia, arbitrum, celo, sepolia) |
| `--broadcast` | Actually send transactions |
| `--update-schemas` | Update EAS schemas only |
| `--force` | Force fresh deployment (skip cache) |
| `--dry-run` | Validate + simulate without broadcasting (may still call RPC) |
| `--pure-simulation` | Compile + preflight only, no RPC/network calls |

### Network Configuration

| Network | Chain ID | RPC Variable | Usage |
|---------|----------|-------------|-------|
| Localhost (Anvil) | 31337 | Local | Development |
| Sepolia | 11155111 | `SEPOLIA_RPC_URL` | Default testnet |
| Base Sepolia | 84532 | `BASE_SEPOLIA_RPC_URL` | Legacy testnet |
| Arbitrum One | 42161 | `ARBITRUM_RPC_URL` | Production |
| Celo | 42220 | `CELO_RPC_URL` | Production |

### Deployment Artifacts

```
packages/contracts/deployments/
  11155111-latest.json   # Sepolia
  42161-latest.json      # Arbitrum
  42220-latest.json      # Celo
  31337-latest.json      # Localhost
  networks.json          # Network registry
```

Imported by `@green-goods/shared` for contract address resolution.

---

## Reference Files

| Sub-File | Contents |
|----------|----------|
| [deployment.md](./deployment.md) | Rollback procedures, environment promotion, Vercel config, local dev, pre-deployment checklist, indexer deployment |
| [ci-cd.md](./ci-cd.md) | GitHub Actions workflows (11), path-filtering, caching strategy, PR status gates, secrets management, local CI simulation |
| [git-workflow.md](./git-workflow.md) | Branch strategy, conventional commits, conflict resolution, release tagging, PR best practices |
| [dependency-management.md](./dependency-management.md) | Bun workspace protocol, lockfile handling, update workflow, phantom dependencies, security audit, version pinning |
| [biome.md](./biome.md) | Biome configuration, import organization, editor setup, Prettier migration, contracts exception (forge fmt) |

---

## Anti-Patterns

### Deployment
1. **Never use `forge script` directly** -- always use `deploy.ts`
2. **Never deploy to mainnet without dry run** -- always validate first
3. **Never skip the deployment order** -- contracts must deploy before indexer
4. **Never create package-specific `.env` files** -- single root `.env` only
5. **Never modify `config/schemas.json`** -- it defines production EAS schemas

### CI/CD & Git
6. **Never run all tests without path filters** -- wastes CI minutes on unchanged packages
7. **Never skip `--frozen-lockfile` in CI** -- causes dependency drift
8. **Never force push shared branches** -- rewrites history others depend on
9. **Never merge without CI passing** -- required status checks exist for a reason
10. **Never commit secrets** -- check for .env, credentials, API keys

### Dependencies & Formatting
11. **Never install root deps for package-specific needs** -- install in the correct package
12. **Never update all deps at once without testing** -- isolate changes
13. **Never manually edit `bun.lockb`** -- binary format, always regenerate
14. **Never use Prettier alongside Biome** -- they conflict; remove Prettier if found
15. **Never manually sort imports** -- Biome's `organizeImports` handles it

---

## Decision Tree

```
What ops work?
|
+-- Deploying something? -----------> deployment.md
|     contracts / indexer / frontend
|
+-- CI/CD pipeline work? -----------> ci-cd.md
|     workflows / caching / gates
|
+-- Git operations? ----------------> git-workflow.md
|     branch / commit / merge / PR
|
+-- Dependency issues? -------------> dependency-management.md
|     install / update / lockfile
|
+-- Formatting / imports? ----------> biome.md
|     bun format / editor setup
|
+-- Pre-commit validation? ---------> Quick Reference (Part 1)
      bun format && bun lint && bun run test && bun build
```

---

## Related Skills

- `contracts` -- Solidity development patterns, testing, and build system
- `testing` -- TDD workflow, Vitest patterns, E2E with Playwright
- `indexer` -- Event handler development, schema design, Docker setup
- `vite` -- Frontend build configuration
- `migration` -- Cross-package breaking changes and dependency upgrades
