# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Quick Start
```bash
# Initial setup (checks dependencies, installs packages, creates .env)
bun setup

# Start all services via PM2 (client, admin, indexer)
bun dev

# Stop all services
bun dev:stop

# Stream logs for a specific service
bun exec pm2 logs client
bun exec pm2 logs admin
bun exec pm2 logs indexer
```

### Code Quality
```bash
# Format and lint entire workspace
bun format && bun lint

# Run all tests across workspace
bun test

# Build everything (respects dependency order)
bun build

# Full validation before committing
bun format && bun lint && bun test && bun build
```

### Package-Specific Commands

**Client (PWA):**
```bash
cd packages/client
bun test              # Run tests
bun build            # Build (includes TypeScript check)
bun lint             # Lint with oxlint
```

**Admin Dashboard:**
```bash
cd packages/admin
bun test              # Run tests
bun build            # Build (includes TypeScript check)
bun lint             # Lint with oxlint
```

**Smart Contracts:**
```bash
cd packages/contracts
bun test              # Run unit tests (skips E2E)
bun build            # Compile contracts
bun lint             # Format & lint with forge fmt + solhint
bun deploy:testnet   # Deploy to Base Sepolia (default)
```

**Indexer:**
```bash
cd packages/indexer
bun test              # Run tests
bun build            # Build indexer
bun dev              # Start local indexer
```

**Shared Package:**
```bash
cd packages/shared
npx tsc --noEmit     # Type check
bun test             # Run tests
bun lint             # Lint with oxlint
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
├── shared/       # Common hooks, providers, stores, modules
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
import deployment from '../../../contracts/deployments/84532-latest.json';
const gardenToken = deployment.gardenToken;

// ❌ Wrong
const GARDEN_TOKEN = '0x1234...';  // Never hardcode
```

**Offline Sync**: Client uses IndexedDB + Service Workers for offline operation with job queue for background sync.

```typescript
// Job queue handles offline work submission
import { useJobQueue, JobKind } from '@green-goods/shared';
const { addJob } = useJobQueue();

// Queue work for sync when online
await addJob({
  kind: JobKind.WORK_SUBMISSION,
  payload: { gardenAddress, actionUID, ... },
  maxRetries: 3
});
```

**Authentication**: Dual auth system - Reown AppKit for wallets, Pimlico for passkey accounts.

```typescript
import { useAuth } from '@green-goods/shared';
const { user, isPasskeyUser, loginWithPasskey, loginWithWallet } = useAuth();
```

### Codebase Organization

**Shared Package Structure** (`packages/shared/src/`):
- `components/` - Reusable UI components
- `hooks/` - Domain-organized hooks (`app/`, `auth/`, `garden/`, `work/`, `blockchain/`)
- `modules/` - Business logic modules
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
- **Vite** for bundling
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

- `VITE_CHAIN_ID`: Target blockchain (84532=Base Sepolia, 42161=Arbitrum, 42220=Celo)
- `VITE_PIMLICO_API_KEY`: For passkey authentication
- `VITE_WALLETCONNECT_PROJECT_ID`: For wallet connections
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

**MANDATORY**: Use `deploy.ts`, never direct `forge script`.

```bash
# ✅ ALWAYS
bun deploy:testnet
bun script/deploy.ts core --network baseSepolia --broadcast

# ❌ NEVER
forge script script/Deploy.s.sol --broadcast --rpc-url $RPC
```

**Why**: `deploy.ts` loads root `.env`, uses Foundry keystore, handles schemas, updates Envio indexer.

**Deployment Flags**:
```bash
bun script/deploy.ts core --network baseSepolia              # Dry run
bun script/deploy.ts core --network baseSepolia --broadcast  # Deploy
bun script/deploy.ts core --network baseSepolia --broadcast --update-schemas  # With schemas
```

**Pre-Deployment Checklist**:
- [ ] Tests passing: `bun --filter contracts test`
- [ ] Build succeeds: `bun --filter contracts build`
- [ ] Dry run successful
- [ ] Deployer funded
- [ ] RPC accessible

## Output Consistency Standards

### Code Style
- **Format**: Always run `bun format` (Biome) before suggesting code
- **Imports**: Use `@green-goods/shared` barrel exports
- **Naming**: Follow existing patterns in neighboring files
- **Comments**: Only add where logic isn't self-evident

### Response Patterns
When implementing features:
1. Check existing patterns in the same package first
2. Use TodoWrite for multi-step tasks
3. Run validation (`bun format && bun lint && bun test`) before completing

### Anti-Patterns to Avoid
- Adding features beyond what was requested
- Creating abstractions for one-time operations
- Adding backwards-compatibility shims unnecessarily
- Hardcoding addresses (use deployment artifacts)
- Defining hooks outside `@green-goods/shared`
- Using `any` without documentation
- Swallowing errors silently

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
| **Feature** | cracked-coder (GATHER → PLAN → TEST → IMPLEMENT → VERIFY) | **Yes** |
| **Bug** | `/debug` → root cause → cracked-coder (if complex) | If complex |
| **Polish** | Direct Claude (no agent needed) | No |

### Available Commands (4)

| Command | Purpose |
|---------|---------|
| `/plan` | Create, check, and execute implementation plans |
| `/review` | Perform 6-pass code review, process feedback |
| `/debug` | Systematic debugging with root cause analysis |
| `/audit` | Comprehensive codebase health analysis |

### Available Skills (4)

| Skill | Purpose |
|-------|---------|
| **plan** | Create plans, check progress, execute in batches |
| **review** | 6-pass ultra-critical review, GitHub posting |
| **debug** | Root cause analysis, verification before completion |
| **audit** | Dead code detection, architectural anti-patterns |

### Available Agents (3)

| Agent | Purpose | Self-Contained |
|-------|---------|----------------|
| `oracle` | Deep research with evidence | Yes (full context embedded) |
| `cracked-coder` | Feature implementation with TDD | No (references CLAUDE.md) |
| `code-reviewer` | 6-pass systematic review | No (references CLAUDE.md) |

### When to Use Agents

| Situation | Use | Why |
|-----------|-----|-----|
| Research question, multi-source investigation | `oracle` | Deep research with evidence |
| Feature implementation | `cracked-coder` | TDD mandatory, full workflow |
| Complex implementation (>50 lines) | `cracked-coder` | Maintains focus, tracks progress |
| PR review before merge | `code-reviewer` | 6-pass systematic review |
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

### MCP Servers (6)

| Server | Purpose |
|--------|---------|
| `figma` | Design context extraction |
| `vercel` | Deployment management |
| `miro` | Whiteboard collaboration |
| `railway` | Railway deployment |
| `foundry` | Contract development (forge, cast, anvil) |
| `storacha` | IPFS/Filecoin storage |

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
