# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Quick Start
```bash
# Initial setup (checks dependencies, installs packages, creates .env)
bun setup

# Start all services via PM2 (client, admin, indexer, storybook)
bun dev

# Stop all services
bun dev:stop

# Stream logs for a specific service
bunx pm2 logs client
bunx pm2 logs admin
bunx pm2 logs indexer
bunx pm2 logs storybook
```

### Code Quality
```bash
# Format and lint entire workspace
bun format && bun lint

# Run all tests across workspace
bun run test

# Build everything (respects dependency order)
bun build

# Full validation before committing
bun format && bun lint && bun run test && bun build

# Contract production readiness (build → lint → tests → E2E → dry runs on all chains)
bun run verify:contracts              # Full verification
bun run verify:contracts:fast         # Skip E2E + dry runs for quick iteration
```

> **CRITICAL: `bun test` vs `bun run test`** — These are **different commands**. `bun test` invokes bun's built-in test runner (ignores vitest config, no jsdom). `bun run test` executes the package.json `"test"` script (vitest with proper environment). **Always use `bun run test`** for packages that use vitest (shared, client, admin). The contracts package uses `forge test` under the hood, so either form works there.

### Package-Specific Commands

**Client (PWA):**
```bash
cd packages/client
bun run test          # Run tests (vitest)
bun build            # Build (includes TypeScript check)
bun lint             # Lint with oxlint
```

**Admin Dashboard:**
```bash
cd packages/admin
bun run test          # Run tests (vitest)
bun build            # Build (includes TypeScript check)
bun lint             # Lint with oxlint
```

**Smart Contracts:**
```bash
cd packages/contracts
bun run test              # Run unit tests (skips E2E)
bun build                 # Adaptive build (~2s cached, skips test/script when unchanged)
bun build:fast            # Explicit fast (~2s cached, source contracts only)
bun build:full            # Full compilation including tests (>180s cold, for CI/deploy)
bun run test:lite         # ~35 fast tests, excludes heavy/account suites (~30s)
bun run test:e2e          # Full E2E suite (workflow + karma fork)
bun run test:e2e:workflow # E2E workflow test only
bun run test:fork         # Fork tests (requires RPC URLs in .env)
bun lint                  # Format & lint with forge fmt + solhint
bun deploy:testnet        # Deploy to Sepolia (default)
```

> **CRITICAL: Never use `forge build` or `forge test` directly.** Always use the `bun` scripts above. `bun build` runs the adaptive build script (`build-adaptive.ts`) which selects fast (~2s cached) vs full (~180s cold) mode based on what changed — raw `forge build` always does a slow full build. `bun run test` wraps `forge test` with the correct exclusions, environment loading, and pre-build steps.

**Indexer:**
```bash
cd packages/indexer
bun run test          # Run tests (mocha)
bun build            # Build indexer
bun dev              # Start via PM2 (uses Docker on macOS)
bun run dev:docker    # Start Docker-based indexer directly
bun run dev:docker:logs  # View Docker logs
bun run dev:docker:down  # Stop Docker containers
```

> **macOS Note**: The native Envio indexer crashes due to a Rust `system-configuration` crate panic. PM2 automatically uses the Docker-based indexer (`docker-compose.indexer.yaml`) which containerizes PostgreSQL, Hasura, and the Envio indexer together.

**Shared Package:**
```bash
cd packages/shared
bun run test         # Run tests (vitest + jsdom)
bun lint             # Lint with oxlint
bun run storybook    # Start Storybook dev server (port 6006)
bun run build-storybook  # Build static Storybook
```

## High-Level Architecture

Green Goods is an **offline-first, single-chain** platform for documenting conservation work on-chain. Built as a Bun monorepo with these key principles:

1. **Offline-First**: Client PWA works without internet, syncs when connected
2. **Single Environment**: All packages share root `.env` file (never create package-specific .env)
3. **Single Chain**: Apps target one chain set by `VITE_CHAIN_ID` at build time
4. **Shared Logic**: All React hooks and business logic in `@green-goods/shared` package

### Package Structure
```
packages/
├── client/       # Offline-first React PWA for gardeners (port 3001)
├── admin/        # React dashboard for operators (port 3002)
├── shared/       # Common hooks, providers, stores, modules, Storybook (port 6006)
├── indexer/      # Envio GraphQL API indexing blockchain events (port 8080)
├── contracts/    # Solidity smart contracts (Foundry framework)
└── agent/        # Multi-platform bot (Telegram primary)
```

### Key Architectural Patterns

**Hook Boundary**: ALL React hooks MUST live in `@green-goods/shared`. Client/admin packages only contain components and views.

```typescript
// ✅ Correct - import hooks from shared
import { useAuth, useGardens, useRole } from '@green-goods/shared';

// ❌ Wrong - never define hooks in client/admin
export function useLocalHook() { ... }  // DON'T DO THIS
```

**Contract Integration**: Import deployment artifacts, never hardcode addresses.

```typescript
// ✅ Correct
import deployment from '../../../contracts/deployments/11155111-latest.json';
const gardenToken = deployment.gardenToken;

// ❌ Wrong
const GARDEN_TOKEN = '0x1234...';  // Never hardcode
```

**Offline Sync**: Client uses IndexedDB + Service Workers for offline operation with job queue for background sync. See "Offline & Job Queue" section below for code patterns.

**Authentication**: Dual auth system - Reown AppKit for wallets, Pimlico for passkey accounts.

```typescript
import { useAuth } from '@green-goods/shared';
const { user, isPasskeyUser, loginWithPasskey, loginWithWallet } = useAuth();
```

### Codebase Organization

**Shared Package Structure** (`packages/shared/src/`):
- `components/` - Reusable UI components
- `hooks/` - Domain-organized hooks (`action/`, `app/`, `assessment/`, `auth/`, `blockchain/`, `conviction/`, `cookie-jar/`, `ens/`, `garden/`, `gardener/`, `hypercerts/`, `roles/`, `translation/`, `utils/`, `vault/`, `work/`, `yield/`)
- `modules/` - Business logic modules (including `marketplace/` adapters)
- `providers/` - React context providers
- `stores/` - Zustand state stores
- `types/` - TypeScript type definitions
- `utils/` - Utility functions
- `workflows/` - XState state machines

**Query Key Patterns** (see `hooks/query-keys.ts`):
```typescript
import { queryKeys, queryInvalidation } from '@green-goods/shared';

// Standard query key usage
useQuery({ queryKey: queryKeys.gardens.list(chainId) });

// Invalidation after mutations
queryInvalidation.gardens(queryClient);
```

**Test Organization**:
- Location: `__tests__/` directories parallel to source
- Naming: `[filename].test.ts` or `[filename].test.tsx`
- Factories: Use `packages/shared/src/__tests__/test-utils/mock-factories.ts`

### Critical Dependencies

- **React 19** + TypeScript (strict mode)
- **Vite 7.x** for bundling
- **TailwindCSS v4** + Radix UI
- **TanStack Query** for data fetching (with graphql-request for GraphQL)
- **Wagmi + Viem** for Web3
- **Foundry** for smart contracts
- **Envio** for blockchain indexing
- **Zustand** for state management
- **Biome** for formatting (35x faster than Prettier)
- **oxlint** for linting

### Build Order

Packages have dependencies that require building in order:

1. **contracts** → Generates ABIs needed by other packages
2. **shared** → Needs contract artifacts, provides hooks/modules
3. **indexer** → Needs contract ABIs
4. **client/admin/agent** → Need shared package

The root `bun build` command handles this automatically.

### Environment Configuration

Single `.env` file at root - key variables:

- `VITE_CHAIN_ID`: Target blockchain (11155111=Sepolia, 42161=Arbitrum, 42220=Celo)
- `VITE_PIMLICO_API_KEY`: For passkey authentication
- `VITE_WALLETCONNECT_PROJECT_ID`: For wallet connections
- `VITE_POSTHOG_KEY` & `VITE_POSTHOG_HOST`: PostHog analytics and error tracking
- `VITE_STORACHA_KEY` & `VITE_STORACHA_PROOF`: IPFS storage

See `.env.example` for all variables with setup instructions.

## Development Patterns

### Type System Essentials

**Golden Rule**: All domain types live in `@green-goods/shared` and must be explicitly imported.

```typescript
// ✅ Correct
import type { Garden, Work, Action } from '@green-goods/shared';

// ❌ Wrong - no global types
const garden: Garden = { ... }; // Don't rely on globals
```

**Type Categories**:
- **Domain types**: `Garden`, `Work`, `Action`, `WorkApproval`, `GardenAssessment`
- **Card variants**: `GardenCard`, `WorkCard`, `ActionCard`, `GardenerCard`
- **Drafts**: `WorkDraft`, `WorkApprovalDraft`, `AssessmentDraft`
- **Job queue**: `Job`, `JobKind`, `JobPayload`, `WorkJobPayload`
- **Offline**: `OfflineStatus`, `OfflineWorkItem`, `SyncMetrics`
- **Addresses**: Use `Address` from `@green-goods/shared` (not `Hex` from viem)

**When to Create Local Types**:
- ✅ Component props, view models, form helpers
- ❌ Domain entities, API payloads, business logic types

**When `any` is Acceptable**:
- External API boundaries with unknown response shapes
- Vite env access: `(import.meta as any).env`
- Third-party library typing workarounds (document with comment)
- Test mocks and fixtures

**Never Use `any` For**:
- Internal function parameters
- State/store types
- Undocumented `as any` casts

### Error Handling

**Error Categories**:

| Category | Examples | Response |
|----------|----------|----------|
| `network` | Fetch failed, timeout | Retry with backoff, show offline indicator |
| `validation` | Invalid input, schema mismatch | Show form errors, highlight fields |
| `auth` | Session expired, unauthorized | Redirect to login, clear state |
| `permission` | Forbidden action, wrong role | Show access denied, suggest action |
| `blockchain` | Tx failed, gas estimation | Show failure, offer retry with details |
| `storage` | IndexedDB full, quota exceeded | Prompt cleanup, degrade gracefully |

**Contract Error Handling**:
```typescript
import { parseContractError, USER_FRIENDLY_ERRORS } from '@green-goods/shared';

try {
  await contractCall();
} catch (error) {
  const parsed = parseContractError(error);
  const message = USER_FRIENDLY_ERRORS[parsed.name] || 'Transaction failed';
  toast.error(message);
}
```

**Toast Patterns**:
```typescript
import { toastService, createWorkToasts } from '@green-goods/shared';
const workToasts = createWorkToasts(t); // t = translation function
toastService.show(workToasts.submitting);
```

**Never Swallow Errors**:
```typescript
// ❌ Wrong — error disappears
try { await riskyOp(); } catch (e) { }

// ✅ Correct — log AND handle
try {
  await riskyOp();
} catch (error) {
  logger.error("Operation failed", { error });
  toast.error(getUserFriendlyMessage(error, intl));
}
```

### Offline & Job Queue

**When to Use Job Queue**: Any action that writes to blockchain or IPFS.

```typescript
import { useJobQueue, JobKind } from '@green-goods/shared';

const { addJob, getJobs } = useJobQueue();

// Queue work for offline-safe submission
await addJob({
  kind: JobKind.WORK_SUBMISSION,
  payload: { gardenAddress, actionUID, ... },
  maxRetries: 3
});

// Check queue status
const pendingJobs = getJobs({ status: 'pending' });
```

**Job Lifecycle**: `pending` → `processing` → `completed`/`failed`

**Media Upload**: Use `mediaResourceManager` for blob URL tracking to prevent memory leaks.

### Performance Guidelines

**Bundle Budgets**:
- Main bundle: < 150KB gzipped
- Per-route chunk: < 50KB gzipped
- Total JS: < 400KB gzipped

**React Optimization**:
- Use `useMemo` for expensive computations and complex filtering
- Use `useCallback` for callbacks passed to memoized children
- Use `React.memo` for components in lists or receiving stable props
- Don't use them for simple values or primitives

**List Virtualization**: For lists > 50 items, use `@tanstack/react-virtual`.

**Cleanup**: Always revoke blob URLs, cancel AbortControllers, unsubscribe event listeners.

### Testing Standards

**Coverage Targets**:

| Package | Critical Paths | Overall | Notes |
|---------|---------------|---------|-------|
| Client | 80%+ | 70%+ | 100% for auth/encryption |
| Admin | 70%+ | 70%+ | 100% for access control |
| Shared | 80%+ | 70%+ | Core logic, all hooks |
| Contracts | 100% (mainnet) | 80% (testnet) | Gas tests required |

**Validation by Task Type**:

| Task | Required |
|------|----------|
| New feature | `build` + `lint` + `test` |
| Bug fix | `build` + `lint` + affected tests |
| Refactor | `build` + `lint` + `test` |
| Type changes | `build` + `lint` |
| Config change | `build` |

### Coding Principles

**DRY**: If writing similar code a third time, extract to `@green-goods/shared`.

**KISS**: Prefer simple, readable solutions over clever abstractions.

**YAGNI**: Don't implement features until needed. Delete unused code completely.

**Optimize for Deletion**: Design modules that are easy to remove.

**Self-Documenting Code**: Names explain intent, comments explain "why".

## Contract Deployment

**MANDATORY**: Use `bun` scripts for all contract operations (see "Smart Contracts" in Package-Specific Commands above and Rule 14). `deploy.ts` loads root `.env`, uses Foundry keystore, handles schemas, and updates Envio indexer config.yaml.

### What Gets Deployed

`DeploymentBase._deployCoreContracts()` deploys and wires the **full protocol stack** (18+ addresses plus schema UIDs):

1. **DeploymentRegistry** — Governance + deployment registry
2. **Guardian** — Recovery guard + account safety controls
3. **ActionRegistry** — Domain/action management (UUPS proxy)
4. **WorkResolver** — EAS work submission resolver (ResolverStub + UUPS)
5. **WorkApprovalResolver** — EAS work approval resolver (ResolverStub + UUPS)
6. **AssessmentResolver** — EAS assessment resolver (ResolverStub + UUPS)
7. **HatsModule** — Role/permission adapter
8. **GardenAccount implementation** — ERC-6551 account logic
9. **AccountProxy** — ERC-6551 account proxy factory target
10. **GardenToken** — Garden NFT + token-bound account mint flow
11. **GardenerAccount logic** — Gardener smart account implementation
12. **KarmaGAPModule** — GAP integration module
13. **OctantFactory** — Octant integration dependency
14. **OctantModule** — Yield vault integration module
15. **GardensModule** — Community/signal module integration
16. **CookieJarModule** — Cookie Jar allowance integration
17. **YieldSplitter** — Yield distribution and payout routing
18. **GreenGoodsENS** — ENS integration contract
19. **UnifiedPowerRegistry** — Cross-module power registry (when enabled)
20. **HypercertsModule** — Hypercert orchestration module
21. **MarketplaceAdapter** — Hypercert marketplace adapter
22. **Hypercert/market contracts** — `hypercertMinter`, `hypercertExchange`, `transferManager`, `strategyHypercertFractionOffer` (chain-dependent)
23. **Root garden bootstrap** — root garden metadata/address + token ID (chain-dependent)
24. **Schemas payload** — `workSchemaUID`, `workApprovalSchemaUID`, and `assessmentSchemaUID`

### Deployment Artifacts

`_saveDeployment()` writes ALL addresses to `deployments/{chainId}-latest.json`. This JSON is the **source of truth** for:
- Frontend config (`getEASConfig()`, `getDeploymentConfig()`)
- Indexer config updates (`envio-integration.ts`)
- Cross-package imports

> **Zero addresses are not blockers.** A zero address (`0x000...`) in a deployment JSON means that module has not been deployed to that chain yet. This is normal — it simply means a deployment is needed. Optional modules (e.g., `gardensModule`, `yieldSplitter`, `octantModule`) may remain zero on chains where they aren't used. Only core contracts (`gardenToken`, `actionRegistry`, `workResolver`) must be non-zero for the protocol to function.

### Post-Deploy: Envio Indexer Config

`envio-integration.ts` reads the deployment JSON and updates `config.yaml` with deployed addresses. It **skips zero addresses** — undeployed modules are safely ignored and don't overwrite existing config.

### EAS Architecture

The Envio indexer does **NOT** index EAS attestation data. EAS attestation queries (assessments, work approvals) are handled by EAS's own GraphQL indexer at `easscan.org`:
- `shared/modules/data/eas.ts` queries EAS GraphQL directly using schema UIDs from deployment JSONs
- Schema UIDs are saved to `deployments/{chainId}-latest.json` during deployment (automatic with `--update-schemas`)
- The Envio indexer only indexes Green Goods protocol events (ActionRegistry, GardenToken, GardenAccount, etc.)

### Deployment Flags

```bash
bun script/deploy.ts core --network sepolia              # Dry run (compile-only)
bun script/deploy.ts core --network sepolia --broadcast  # Deploy full stack
bun script/deploy.ts core --network sepolia --broadcast --update-schemas  # Deploy + register EAS schemas
```

### Validation Before Deployment

```bash
bun run verify:contracts              # Full: build → lint → tests → E2E → dry runs (all chains)
bun run verify:contracts:fast         # Fast: skip E2E + dry runs
```

For individual steps, see "Smart Contracts" in Package-Specific Commands above. The dry run only validates compilation — real validation comes from E2E and fork tests which use `DeploymentBase`, the same code path as production deployment.

### Pre-Deployment Checklist

- [ ] Production readiness verified: `bun run verify:contracts` (build + lint + tests + E2E + dry runs)
- [ ] Deployer funded on target chain
- [ ] RPC accessible
- [ ] `.env` has correct `VITE_CHAIN_ID` for target chain

### Deployment Order (Multi-Chain)

Deploy in this order: **testnet first, then production**.

```
1. Sepolia (11155111)     — Primary testnet
2. Celo (42220)           — Production
3. Arbitrum (42161)       — Production
```

Per chain:
```bash
# Step 1: Deploy full stack + register schemas
bun script/deploy.ts core --network <chain> --broadcast --update-schemas

# Step 2: Check deployment JSON — zero addresses indicate modules needing deployment (not blockers)
cat deployments/<chainId>-latest.json | jq '.hatsModule, .gardensModule, .yieldSplitter'

# Step 3: Deploy seed data (actions + initial gardens)
bun script/deploy.ts actions --network <chain> --broadcast

# Step 4: Rebuild indexer (picks up new addresses from config.yaml)
cd packages/indexer && bun build
```

### Post-Deployment Verification

```bash
# Check core contracts are deployed (these MUST be non-zero for protocol to work)
jq '.gardenToken, .actionRegistry, .workResolver' deployments/<chainId>-latest.json

# Check optional modules — zero address = not yet deployed on this chain (deploy when needed)
jq '.hatsModule, .gardensModule, .yieldSplitter, .octantModule' deployments/<chainId>-latest.json

# Check schema UIDs (zero = schemas not yet registered, run deploy with --update-schemas)
jq '.schemas.workSchemaUID, .schemas.assessmentSchemaUID, .schemas.workApprovalSchemaUID' deployments/<chainId>-latest.json

# Verify module wiring on-chain (only for non-zero modules)
cast call <gardenToken> "hatsModule()(address)" --rpc-url <RPC>
cast call <gardenToken> "gardensModule()(address)" --rpc-url <RPC>
cast call <gardenToken> "actionRegistry()(address)" --rpc-url <RPC>
```

## Output Consistency Standards

- **Format**: Always run `bun format` (Biome) before suggesting code
- **Imports**: Use `@green-goods/shared` barrel exports, never deep paths
- **Naming**: Follow existing patterns in neighboring files
- **Comments**: Only add where logic isn't self-evident
- **Validation**: Run `bun format && bun lint && bun run test` before completing
- **Progress**: Use TodoWrite for multi-step tasks

## Git Workflow

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

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) with scope:

```
type(scope): description

# Types: feat, fix, refactor, chore, docs, test, perf, ci
# Scopes: contracts, indexer, shared, client, admin, agent, claude
```

**Examples from this repo:**
```
feat(contracts): migrate to Hats Protocol v2 access control
refactor(shared): update hooks, types, and utils for Hats v2
refactor(admin,client): update components for Hats v2 and barrel imports
chore: update root config, add multiformats fix and migration plans
test(contracts): add comprehensive Hats Protocol test suite
```

### PR Guidelines

- Keep PRs focused on a single concern
- Reference the issue/plan in the PR description
- Use the `/review` skill (6-pass review) before merging
- Run full validation: `bun format && bun lint && bun run test && bun build`

## Architectural Rules (14 Core Rules)

> See `.claude/rules/architectural-rules.md` for full details, examples, and scope tags.
> Each rule has a scope: `[react]` = shared/client/admin, `[all-ts]` = any TypeScript, `[contracts]` = Solidity/Foundry.

These rules prevent performance leaks, fragile abstractions, and consistency drifts:

| Rule | Scope | Pattern | Fix |
|------|-------|---------|-----|
| **1. Timer Cleanup** | react | setTimeout in hooks | Use `useTimeout()` or `useDelayedInvalidation()` |
| **2. Event Listeners** | react | addEventListener without cleanup | Use `useEventListener()` or `{ once: true }` |
| **3. Async Races** | react | Async in useEffect without guard | Use isMounted flag or `useAsyncEffect()` |
| **4. Error Handling** | all-ts | Empty catch blocks | Log + track + display; use `parseContractError()` |
| **5. Address Types** | all-ts | `string` for addresses | Use `Address` from `@green-goods/shared` |
| **6. Zustand Selectors** | react | `(state) => state` | Use granular field selectors |
| **7. Query Keys** | react | Unstable object refs | Serialize or use useMemo |
| **8. Form Validation** | react | Manual useState validation | Use React Hook Form + Zod |
| **9. Chained useMemo** | react | useMemo depending on useMemo | Combine into single useMemo |
| **10. Context Values** | react | Inline object literals | Wrap in useMemo |
| **11. Barrel Imports** | all-ts | Deep paths into `@green-goods/shared/...` | Import from `@green-goods/shared` root |
| **12. Console.log Cleanup** | all-ts | `console.log/warn/error` in production | Use logger service from shared |
| **13. Provider Nesting** | react | Wrong provider hierarchy order | Follow documented order (see `architectural-rules.md`) |
| **14. Bun Scripts** | contracts | Raw `forge build`/`forge test` | Use `bun build`/`bun run test` scripts |

### Utility Hooks

Use these hooks from `@green-goods/shared` to enforce patterns:

```typescript
import {
  // Event listeners with auto-cleanup
  useEventListener,
  useWindowEvent,
  useDocumentEvent,
  // Timeouts with auto-cleanup
  useTimeout,
  useDelayedInvalidation,
  // Async effects with mount guards
  useAsyncEffect,
  useAsyncSetup,
} from '@green-goods/shared';
```

## Claude Code Integration

This project has extensive Claude Code tooling configured in `.claude/`.

### Package-Specific Context

When working in a package, load the corresponding context file for detailed patterns:

| Package | Context File |
|---------|--------------|
| `packages/shared/**` | `.claude/context/shared.md` |
| `packages/client/**` | `.claude/context/client.md` |
| `packages/admin/**` | `.claude/context/admin.md` |
| `packages/contracts/**` | `.claude/context/contracts.md` |
| `packages/indexer/**` | `.claude/context/indexer.md` |
| `packages/agent/**` | `.claude/context/agent.md` |

Each context file contains ~200 lines of package-specific patterns, anti-patterns, and reference files.

### The 4 Entry Points

All work enters through one of these flows:

| Entry Point | Flow | TDD |
|-------------|------|-----|
| **PRD** | `/plan` → Specs → Stories → Features | No |
| **Feature** | cracked-coder (SCOPE → GATHER → PLAN → TEST → IMPLEMENT → VERIFY) | **Yes** |
| **Bug** | `/debug` → root cause → cracked-coder (if complex) | If complex |
| **Polish** | Direct Claude (no agent needed) | No |

### Available Skills (33)

See [.claude/skills/index.md](.claude/skills/index.md) for quick reference with invocation keywords.

**Command Skills**: `/plan`, `/review`, `/debug`, `/audit`

**By Domain** (see index.md for full invocation keywords):

| Category | Skills |
|----------|--------|
| **Workflow** | plan, review, debug, audit |
| **Frontend** | react, tanstack-query, frontend-design, radix-ui, tailwindcss, storybook, ui-compliance, i18n, xstate |
| **Web3** | web3, contracts, security, deployment |
| **Data** | data-layer, error-handling-patterns, testing |
| **Infra** | vite, indexer, docker, ci-cd, agent |
| **Operations** | architecture, biome, performance, monitoring, migration, dependency-management, git-workflow, mermaid-diagrams |

### Available Agents (5)

| Agent | Purpose | Self-Contained |
|-------|---------|----------------|
| `oracle` | Deep research with evidence | Yes (full context embedded) |
| `cracked-coder` | Feature implementation with TDD | No (references CLAUDE.md) |
| `code-reviewer` | 6-pass systematic review | No (references CLAUDE.md) |
| `migration` | Cross-package migration orchestration | No (references CLAUDE.md) |
| `triage` | Fast issue classification and routing | Yes (full context embedded) |

### When to Use Agents

| Situation | Use | Why |
|-----------|-----|-----|
| Research question, multi-source investigation | `oracle` | Deep research with evidence |
| Feature implementation | `cracked-coder` | TDD mandatory, full workflow |
| Complex implementation (>50 lines) | `cracked-coder` | Maintains focus, tracks progress |
| PR review before merge | `code-reviewer` | 6-pass systematic review |
| Cross-package migration | `migration` | Blast radius tracking, ordered validation |
| Issue triage, classification | `triage` | Fast routing, package identification |
| Polish, simple changes | Direct Claude | Faster, no overhead |

**Invocation**: Just say "use cracked-coder for this" or "ask oracle about X"

### Session Continuity

**Problem**: Context gets lost in long sessions, plan progress forgotten, work repeated.

**Solution**: All significant work MUST use:

1. **TodoWrite** - Track progress visibly
   - Create todos at session start
   - Mark `in_progress` → `completed` as you work
   - On interruption: todos show exactly where you stopped

2. **Plan Files** - Persistent context in `.plans/`
   - Plan file = source of truth across sessions
   - Update plan as work progresses

### MCP Servers (4)

> **Full workflows:** See [Claude MCP Workflows](docs/docs/developer/claude-mcp-workflows.md) for detailed integration patterns.

| Server | Type | Status | Purpose |
|--------|------|--------|---------|
| `foundry` | Local tools | **Active** | Contract dev (forge v1.3.5, cast, anvil) |
| `storacha` | Local npx | Configured | IPFS/Filecoin media storage |
| `miro` | Remote URL | Available | Architecture diagrams, planning |
| `railway` | Local npx | Available | Indexer deployment, databases |

**Quick Invocation:**
- Contracts: "Compile contracts", "Run tests", "Check balance"
- Storage: "Upload to IPFS"
- Deploy: Use `vercel` CLI directly (not MCP)

### Hooks (Convention Enforcement)

Hooks in `.claude/hooks.json` enforce Green Goods patterns:
- **Quality**: Block hooks in wrong location, block package .env
- **Safety**: Confirm production deploys, block force push to main
- **Workflow**: TDD reminder, i18n reminder, ABI rebuild reminder

## Secure Autonomous Execution

### Recommended: Sandbox Mode

Enable sandboxing for autonomous execution with security boundaries:

```bash
/sandbox
```

This provides:
- **Filesystem isolation** - Only access project directories
- **Network isolation** - Only approved domains
- **84% fewer permission prompts** while maintaining security

### Permission Modes

| Mode | Use Case |
|------|----------|
| `plan` | Safe analysis, no modifications |
| `acceptEdits` | Auto-approve edits, manual command approval |
| `sandbox auto-allow` | Autonomous within boundaries (recommended) |
| `bypassPermissions` | Full autonomy (only in isolated environments) |

### Security Best Practices

1. **Never commit secrets** - Use `.env` (gitignored)
2. **Review contract changes** - Always verify before deployment
3. **Use sandbox for automation** - OS-level isolation
4. **Audit permissions** - Run `/permissions` to review
5. **Verify MCP servers** - Only use trusted servers
