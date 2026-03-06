---
name: deployment
description: Full deployment pipeline - contracts via deploy.ts, indexer via Docker Compose, frontends via Vercel, environment promotion. Use for deployments, releases, and environment management.
disable-model-invocation: true
version: "1.0.0"
status: active
packages: ["contracts", "indexer", "client", "admin"]
dependencies: ["contracts"]
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Deployment Skill

End-to-end deployment guide: smart contracts, indexer, and frontend apps across environments.

---

## Activation

When invoked:
- Identify which package(s) need deployment.
- Follow the deployment order (contracts → indexer → apps).
- Use dry runs before broadcasting any transaction.
- Confirm production deployments with the user before proceeding.

## Part 1: Deployment Order

**Packages must deploy in dependency order:**

```
1. contracts  → Generates ABIs + deployment artifacts
2. indexer    → Needs contract addresses + ABIs
3. shared     → Needs contract artifacts (build only, not deployed)
4. client     → Needs shared + indexer endpoint
5. admin      → Needs shared + indexer endpoint
```

### Cross-Package Dependency Map

```
contracts ──→ deployments/{chainId}-latest.json ──→ shared (ABIs)
                                                  ↘ indexer (addresses)
shared ──→ hooks, types, utils ──→ client
                                ↘ admin
indexer ──→ GraphQL endpoint ──→ client (queries)
                              ↘ admin (queries)
```

## Part 2: Smart Contract Deployment

### MANDATORY: Use deploy.ts

```bash
# ✅ ALWAYS use the TypeScript CLI
bun script/deploy.ts core --network sepolia              # Dry run
bun script/deploy.ts core --network sepolia --broadcast  # Deploy
bun script/deploy.ts core --network sepolia --broadcast --update-schemas  # With schemas

# ❌ NEVER use direct forge commands
# forge script script/Deploy.s.sol --broadcast --rpc-url $RPC
```

**Why deploy.ts exists:**
1. Loads root `.env` (single env file rule)
2. Uses Foundry keystore for secure signing
3. Auto-updates Envio indexer config
4. Handles EAS schema registration
5. Writes deployment artifacts

### CLI Commands

| Command | Purpose |
|---------|---------|
| `bun script/deploy.ts core --network <net>` | Deploy core contracts |
| `bun script/deploy.ts garden <config.json> --network <net>` | Deploy garden config |
| `bun script/deploy.ts hats-tree --network <net>` | Deploy Hats Protocol tree |
| `bun script/deploy.ts status [network]` | Check deployment status |

### CLI Options

| Flag | Purpose |
|------|---------|
| `--network` | Target chain (localhost, baseSepolia, arbitrum, celo, sepolia) |
| `--broadcast` | Actually send transactions. When omitted, execution is non-broadcast but may still run RPC/state checks. |
| `--update-schemas` | Update EAS schemas only |
| `--force` | Force fresh deployment (skip cache) |
| `--dry-run` | Validate config and simulate deployment logic without broadcasting; may still call RPC. |
| `--pure-simulation` | Compile + preflight only with no RPC/network calls. |

### Pre-Deployment Checklist

```bash
# 1. Full production readiness (build → lint → tests → E2E → dry runs on all chains)
bun run verify:contracts

# 2. Check deployer balance
cast balance $(cast wallet address --account deployer) --rpc-url $RPC

# 3. Verify RPC accessibility
cast block-number --rpc-url $RPC
```

> `verify:contracts` runs `scripts/verify-production.sh` which handles build, lint, unit tests, E2E workflow, and dry runs for Sepolia, Arbitrum, and Celo in one command. Use `bun run verify:contracts:fast` to skip E2E and dry runs for quick iteration.

### Network Configuration

| Network | Chain ID | RPC Variable | Usage |
|---------|----------|-------------|-------|
| Localhost (Anvil) | 31337 | Local | Development |
| Sepolia | 11155111 | `SEPOLIA_RPC_URL` | Default testnet |
| Base Sepolia | 84532 | `BASE_SEPOLIA_RPC_URL` | Legacy testnet (secondary) |
| Arbitrum One | 42161 | `ARBITRUM_RPC_URL` | Production |
| Celo | 42220 | `CELO_RPC_URL` | Production |

### Deployment Artifacts

After deployment, artifacts are written to:
```
packages/contracts/deployments/
├── 11155111-latest.json  # Sepolia addresses
├── 42161-latest.json    # Arbitrum addresses
├── 42220-latest.json    # Celo addresses
├── 31337-latest.json    # Localhost addresses
└── networks.json        # Network registry
```

These artifacts are imported by `@green-goods/shared` for contract address resolution.

## Part 3: Indexer Deployment

### Local Development (Docker)

```bash
# Start Docker-based indexer (macOS recommended)
cd packages/indexer
bun run dev:docker          # Start containers
bun run dev:docker:logs     # View logs
bun run dev:docker:down     # Stop containers

# Or via PM2 (auto-selects Docker on macOS)
bun dev                     # From root
```

**macOS Note:** The native Envio indexer crashes due to a Rust `system-configuration` crate panic. PM2 automatically uses Docker (`docker-compose.indexer.yaml`).

### Docker Compose Stack

```
docker-compose.indexer.yaml
├── PostgreSQL        # Event storage
├── Hasura           # GraphQL engine
└── Envio Indexer    # Event processing
```

### Indexer Configuration

When contract addresses change, update the indexer config:

```bash
# deploy.ts handles this automatically with --update-schemas
# Manual update if needed:
cd packages/indexer
# Edit config.yaml with new contract addresses
bun build
```

### Production Deployment (Docker Compose)

The indexer runs as a Docker Compose stack in production, same as local development:

```bash
# Deploy indexer stack
cd packages/indexer
docker compose -f docker-compose.indexer.yaml up -d

# View logs
docker compose -f docker-compose.indexer.yaml logs -f

# Restart after config changes
docker compose -f docker-compose.indexer.yaml down
docker compose -f docker-compose.indexer.yaml up -d

# Check service health
docker compose -f docker-compose.indexer.yaml ps
node -e 'fetch("http://localhost:8080/healthz").then(r=>console.log(r.status))'
```

**Stack components:**
- **PostgreSQL** — Event storage
- **Hasura** — GraphQL engine (port 8080)
- **Envio Indexer** — Event processing

## Part 4: Frontend Deployment (Vercel)

### Client PWA

```bash
# Build locally to verify
cd packages/client
bun build

# Deploy via Vercel CLI
vercel --prod
```

**Vercel Configuration** (`packages/client/vercel.json`):
- Framework: Vite
- Build command: `bun run build`
- Output: `dist/`
- SPA rewrites: `/(.*) → /index.html`
- Service worker: `no-cache` headers on `/sw.js`
- Assets: Immutable caching on `/assets/*`

### Admin Dashboard

```bash
cd packages/admin
bun build
vercel --prod
```

### Environment Variables (Vercel)

Set these in Vercel project settings:

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CHAIN_ID` | Yes | Target blockchain |
| `VITE_PIMLICO_API_KEY` | Yes | Passkey authentication |
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes | Wallet connections |
| `VITE_STORACHA_KEY` | Yes | IPFS storage |
| `VITE_STORACHA_PROOF` | Yes | IPFS storage auth |

**Single chain rule:** Each Vercel deployment targets ONE chain set by `VITE_CHAIN_ID` at build time.

## Part 5: Environment Validation

### Pre-Build Env Check

Validate that all required environment variables are set and correct for the target chain before building:

```bash
# Quick validation script (run before any deployment)
# Check required VITE_ variables exist
for var in VITE_CHAIN_ID VITE_PIMLICO_API_KEY VITE_WALLETCONNECT_PROJECT_ID VITE_STORACHA_KEY VITE_STORACHA_PROOF; do
  if [ -z "$(grep "^${var}=" .env)" ]; then
    echo "MISSING: $var"
  fi
done
```

### Chain-Specific Validation

| Variable | Sepolia (11155111) | Arbitrum (42161) | Celo (42220) |
|----------|---------------------|-----------------|--------------|
| `VITE_CHAIN_ID` | `11155111` | `42161` | `42220` |
| RPC URL required | `SEPOLIA_RPC_URL` | `ARBITRUM_RPC_URL` | `CELO_RPC_URL` |
| Deployment artifact | `11155111-latest.json` | `42161-latest.json` | `42220-latest.json` |

### Validation Checklist

```bash
# 1. Chain ID matches target
CHAIN_ID=$(grep '^VITE_CHAIN_ID=' .env | cut -d'=' -f2)
echo "Target chain: $CHAIN_ID"

# 2. Deployment artifact exists for this chain
ls packages/contracts/deployments/${CHAIN_ID}-latest.json

# 3. RPC endpoint is reachable
RPC_VAR=$(grep "RPC_URL" .env | grep -v "^#" | head -1 | cut -d'=' -f1)
RPC_URL=$(grep "^${RPC_VAR}=" .env | cut -d'=' -f2)
cast block-number --rpc-url "$RPC_URL"

# 4. Indexer endpoint matches chain
# Verify the GraphQL endpoint returns data for the correct chain
node -e 'fetch(`${process.env.GRAPHQL_ENDPOINT}/health`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' || echo "Indexer not reachable"
```

### Common Env Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Wrong `VITE_CHAIN_ID` | Frontend talks to wrong chain | Validate before build |
| Missing deployment artifact | Contract calls fail at runtime | Check file exists |
| Stale RPC URL | Timeouts, connection errors | Test with `cast block-number` |
| Testnet keys in production | Security risk | Use separate key management |
| Missing `VITE_` prefix | Variable not available in browser | TypeScript `env.d.ts` catches this |

## Part 6: Environment Promotion (Testnet → Mainnet)

### Testnet → Mainnet Workflow

```
1. Deploy contracts to testnet → verify behavior
2. Deploy indexer pointing to testnet contracts → verify events
3. Deploy frontend with testnet VITE_CHAIN_ID → E2E test
4. ─── Gate: All tests pass, manual QA complete ───
5. Deploy contracts to mainnet → verify
6. Update indexer for mainnet contracts → verify
7. Deploy frontend with mainnet VITE_CHAIN_ID
```

### Pre-Mainnet Checklist

- [ ] Production readiness verified: `bun run verify:contracts` (all phases green)
- [ ] Gas benchmarks within targets
- [ ] Upgrade safety tests pass (storage layout preserved)
- [ ] Deployer wallet funded on mainnet
- [ ] Indexer config ready for mainnet addresses
- [ ] Frontend env vars set for mainnet chain ID
- [ ] Monitoring/alerting configured

## Part 7: Local Development

### Anvil (Local Fork)

```bash
# Start local Anvil node
anvil

# Deploy to localhost
bun script/deploy.ts core --network localhost --broadcast

# Start all services
bun dev  # PM2 starts client, admin, indexer
```

### PM2 Service Management

```bash
bun dev              # Start all services
bun dev:stop         # Stop all services
bun exec pm2 logs client    # Stream client logs
bun exec pm2 logs admin     # Stream admin logs
bun exec pm2 logs indexer   # Stream indexer logs
bun exec pm2 status         # Check service health
```

## Part 8: Rollback Procedures

### Contract Deployment Failure

Contracts are **immutable once deployed** — you can't "undo" a deployment. Instead:

```
Failed deployment scenario:
1. Transaction reverted → No on-chain state changed, safe to retry
2. Transaction succeeded but wrong config → Deploy corrected version
3. Partial deployment (some contracts deployed) → Continue from where it stopped
```

**Steps:**
```bash
# 1. Check what actually deployed
bun script/deploy.ts status sepolia

# 2. If artifacts were written incorrectly, restore from git
git checkout -- packages/contracts/deployments/11155111-latest.json

# 3. Fix the issue and redeploy
bun script/deploy.ts core --network sepolia --broadcast
```

**For UUPS proxies:** If the implementation is buggy, deploy a new implementation and upgrade:
```bash
# The proxy address stays the same — only the implementation changes
bun script/deploy.ts core --network sepolia --broadcast --force
```

### Indexer Rollback

```bash
# Option 1: Reset and re-index
cd packages/indexer
docker compose -f docker-compose.indexer.yaml down
docker volume rm indexer_postgres  # Clear database
docker compose -f docker-compose.indexer.yaml up -d  # Re-index from scratch

# Option 2: Point indexer at new contract addresses
# Update config.yaml with correct addresses, then:
cd packages/indexer
bun build
docker compose -f docker-compose.indexer.yaml down
docker compose -f docker-compose.indexer.yaml up -d
```

**When to re-index from scratch:**
- Contract addresses changed
- Schema.graphql entity structure changed
- Event handler logic had a bug that corrupted data

### Frontend Rollback (Vercel)

```bash
# List recent deployments
vercel ls

# Promote a previous deployment to production
vercel promote <deployment-url>

# Or rollback via Vercel dashboard:
# Project → Deployments → ... → Promote to Production
```

### Partial Mainnet Failure Recovery

If a multi-step mainnet deployment fails midway:

```
Step 1: Contracts deployed ✅
Step 2: Indexer updated ✅
Step 3: Frontend deploy failed ❌
```

**DO NOT** redeploy contracts or indexer. Fix only the failing step:

```bash
# Identify what failed
vercel logs <deployment-url>

# Fix and redeploy only the frontend
cd packages/client
bun build
vercel --prod
```

**If contracts deployed with wrong parameters:**
1. **STOP** — do not deploy more components
2. Assess if the issue is fixable via upgrade (UUPS) or requires fresh deployment
3. If fresh deployment needed, update ALL downstream config (indexer, frontend)
4. Document the abandoned deployment in a post-mortem

### Rollback Decision Matrix

| Failure | Action | Risk |
|---------|--------|------|
| Contract tx reverted | Retry (no state changed) | None |
| Wrong contract config | Upgrade via UUPS proxy | Low |
| Indexer data corruption | Re-index from scratch | Medium (downtime) |
| Frontend build failure | Fix and redeploy | Low |
| Wrong chain deployment | Cannot undo, deploy on correct chain | Medium |
| Secret exposure | Rotate keys immediately, redeploy | **CRITICAL** |

## Anti-Patterns

- **Never use `forge script` directly** — always use `deploy.ts`
- **Never hardcode RPC URLs** — use `.env` variables
- **Never deploy to mainnet without dry run** — always validate first
- **Never skip the deployment order** — contracts must deploy before indexer
- **Never create package-specific `.env` files** — single root `.env` only
- **Never deploy frontend before indexer** — GraphQL endpoint must be live
- **Never modify `config/schemas.json`** — it defines production EAS schemas

## Related Skills

- `contracts` — Solidity development patterns and testing
- `indexer` — Event handler development and schema design
- `vite` — Frontend build configuration
