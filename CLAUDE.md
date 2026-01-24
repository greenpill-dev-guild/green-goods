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
import { useJobQueue, JobType } from '@green-goods/shared';
const { addJob } = useJobQueue();

// Queue work for sync when online
await addJob({
  type: JobType.SUBMIT_WORK,
  data: { gardenAddress, workData },
  retries: 3
});
```

**Authentication**: Dual auth system - Reown AppKit for wallets, Pimlico for passkey accounts.

```typescript
import { useAuth } from '@green-goods/shared';
const { user, isPasskeyUser, loginWithPasskey, loginWithWallet } = useAuth();
```

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

### Testing Philosophy

- **Client/Admin**: 70%+ coverage, 100% for auth/encryption paths
- **Contracts**: 100% coverage for mainnet, comprehensive gas tests
- **Shared**: 80%+ coverage, all hooks must have tests
- **E2E Tests**: Playwright tests in `tests/` directory

### Development Workflow

1. Make changes following existing patterns (check neighboring files)
2. Run validation: `bun format && bun lint && bun test`
3. Build affected packages to verify: `bun --filter [package] build`
4. Use conventional commits: `feat(client): add feature` or `fix(contracts): resolve issue`
5. Never commit without running lint/test/build
6. **Always run `bun install`** after adding new packages or updating dependency versions in package.json

### Key Design Decisions

- **No package-specific .env files** - everything uses root `.env`
- **No runtime chain switching** - single chain per deployment
- **All hooks in shared package** - maintains clean architecture
- **Offline-first with job queue** - handles poor connectivity
- **UUPS upgradeable contracts** - allows fixing bugs post-deployment
- **EAS for attestations** - leverages existing infrastructure

For detailed patterns and rules, see the `.cursor/rules/` directories throughout the codebase.

## Claude Code Integration

This project has extensive Claude Code tooling configured in `.claude/`.

### The 4 Entry Points

All work enters through one of these flows:

| Entry Point | Flow | TDD |
|-------------|------|-----|
| **PRD** | `/plan` → Specs → Stories → Features | No |
| **Feature** | cracked-coder (GATHER → PLAN → TEST → IMPLEMENT → VERIFY → DEPLOY) | **Yes** |
| **Bug** | `/debug` → root cause → cracked-coder (if complex) | If complex |
| **Polish** | Direct Claude (no agent needed) | No |

```
PRD → /plan → docs/specs/ → Stories → Features
                                         ↓
Feature ────────────────► cracked-coder (TDD)
                                         ↓
Bug → /debug ───────────► cracked-coder (if complex)
                                         ↓
Polish → Direct Claude    /review → Deploy via MCP
```

### Available Commands (4)

| Command | Purpose |
|---------|---------|
| `/plan` | Create, check, and execute implementation plans |
| `/review` | Perform 6-pass code review, process feedback |
| `/debug` | Systematic debugging with root cause analysis |
| `/audit` | Comprehensive codebase health analysis |

### Available Skills (4)

| Skill | Consolidates | Purpose |
|-------|--------------|---------|
| **plan** | Planning lifecycle + GG patterns | Create plans, check progress, execute in batches. Includes hook generation, offline-sync, and i18n patterns |
| **review** | Code review workflow | 6-pass ultra-critical review, request/receive feedback, GitHub posting |
| **debug** | Debugging + verification | Root cause analysis, verification before completion |
| **audit** | Codebase analysis | Dead code detection, architectural anti-patterns, type issues |

### Available Agents (3)

| Agent | Purpose | MCP Access |
|-------|---------|------------|
| `cracked-coder` | Feature implementation with TDD | foundry, vercel, railway, storacha, figma |
| `code-reviewer` | 6-pass ultra-critical review, posts to GitHub | None (read-only) |
| `oracle` | Deep research with evidence | figma, miro |

### When to Use Agents

| Situation | Use | Why |
|-----------|-----|-----|
| Feature implementation | `cracked-coder` | TDD mandatory, full MCP for deploy |
| Complex implementation (>50 lines) | `cracked-coder` | Maintains focus, tracks progress |
| Research question, multi-source investigation | `oracle` | Deep research with evidence |
| PR review before merge | `code-reviewer` | 6-pass systematic review |
| Deployment (apps, contracts, indexer) | `cracked-coder` | Has vercel, foundry, railway MCP |
| Polish, simple changes | Direct Claude | Faster, no TDD overhead |

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
   - Team members can read plan to understand state

3. **Convention Hooks** (4 categories) - Prevent drift
   - **Quality**: Block hooks in wrong location, block package .env
   - **Safety**: Confirm production deploys, block force push to main
   - **Workflow**: TDD reminder, i18n reminder, ABI rebuild reminder
   - **Lifecycle**: Agent protocol reminders, TodoWrite verification

**Team Handoffs**: Next person reads todos + plan file → knows exactly where things stand.

### Enabled Plugins (4)

| Plugin | Purpose |
|--------|---------|
| `github` | GitHub integration (PRs, issues, workflow) |
| `typescript-lsp` | TypeScript language server |
| `figma` | Figma design extraction via MCP |
| `vercel` | Vercel deployment management |

### MCP Servers (6)

| Server | Purpose |
|--------|---------|
| `figma` | Design context extraction |
| `vercel` | Deployment management |
| `miro` | Whiteboard collaboration |
| `railway` | Railway deployment |
| `foundry` | Contract development (forge, cast, anvil) |
| `storacha` | IPFS/Filecoin storage |

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

### Sandbox Configuration

In `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(bun:*)",
      "Bash(forge:*)",
      "Bash(cast:*)",
      "Bash(git:*)"
    ],
    "deny": [
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(sudo:*)"
    ]
  },
  "sandbox": {
    "filesystem": {
      "allow": ["packages/**", "scripts/**"],
      "deny": ["~/.ssh", "~/.aws", "~/.env*"]
    },
    "network": {
      "mode": "auto-allow",
      "allowedDomains": [
        "github.com",
        "api.github.com",
        "registry.npmjs.org",
        "sepolia.base.org",
        "mcp.figma.com",
        "mcp.vercel.com"
      ]
    }
  }
}
```

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
