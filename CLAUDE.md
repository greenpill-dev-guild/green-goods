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

### Available Commands

| Command | Purpose |
|---------|---------|
| `/pr` | Create PR with issue linking and conventional commits |
| `/review` | Review changes against implementation plan |
| `/audit` | Run comprehensive codebase audit |
| `/delphi` | Launch parallel oracle analysis (e.g., `delphi x6`) |
| `/plan` | Create detailed implementation plan |
| `/execute` | Execute plan in batches with checkpoints |
| `/fix-lint` | Auto-fix linting issues |
| `/scope` | Check for scope creep |
| `/shitshow` | Emergency troubleshooting mode |

### Available Skills (24)

**Development Workflow:**
- `create-plan`, `check-plan`, `executing-plans` - Planning lifecycle
- `create-pr`, `code-review`, `requesting-code-review`, `receiving-code-review` - PR workflow
- `test-driven-development` - TDD methodology
- `verification-before-completion` - Evidence-based completion

**Analysis & Research:**
- `audit`, `architectural-analysis` - Codebase health
- `delphi`, `the-oracle` - Deep research and parallel analysis
- `systematic-debugging` - Root cause analysis

**Specialized:**
- `contract-deploy-validator` - UUPS validation, gas reports
- `hook-generator` - Generate hooks in shared package
- `i18n-sync` - Translation completeness
- `offline-sync-debugger` - Job queue and IndexedDB debugging
- `superpower-zustand` - Zustand store patterns
- `design-spec-extraction` - Extract Figma design tokens
- `chrome-devtools` - Browser debugging
- `gh-ticket` - AI-powered issue creation with context
- `the-archivist` - Decision documentation
- `4-step-program` - Fix-review-iterate workflow

### GitHub Issue Creation

Use `/ticket` or the `gh-ticket` skill to create context-rich GitHub issues. The skill auto-detects issue type and populates AI context sections.

**Quick Commands:**
```bash
/ticket bug "Description"              # Bug report with triage label
/ticket feature "Description"          # Simple feature (1-2 packages)
/ticket feature --complete "Desc"      # AI-buildable spec (3+ packages)
/ticket task "Description"             # Engineering task
/ticket contract "Description"         # Smart contract work
/ticket hook "Description"             # New shared hook
/ticket spike "Description"            # Research/investigation
```

**Two-Tier Feature Templates:**

| Template | Flag | Use For |
|----------|------|---------|
| Feature Simple | `/ticket feature` | Quick features, 1-2 packages, human implementation |
| **Feature Complete** | `/ticket feature --complete` | **AI-buildable specs**: 3+ packages, offline support, AI agent assignment |

Use `--complete` when the feature spans multiple packages or will be assigned to an AI agent. It includes:
- Testable acceptance criteria (Given/When/Then)
- TypeScript API contracts for hooks/stores
- GraphQL schema additions
- Test specifications with fixtures
- Error handling matrix
- Offline implementation patterns
- AI self-verification checklist

**All Issue Templates:**

| Template | Labels | Use For |
|----------|--------|---------|
| 🐛 Bug Report | `bug`, `triage` | Bugs with reproduction steps |
| ✨ Feature (Simple) | `enhancement` | Quick features, human implementation |
| ✨ Feature (Complete) | `enhancement` | AI-buildable specs, complex features |
| 🔧 Engineering Task | `task` | Specific engineering work |
| 📜 Smart Contract | `contract` | Contract creation/modification |
| 🪝 Shared Hook | `component` | New hooks in shared package |
| 🔬 Spike | `spike` | Research with timebox |

**Package Labels** (auto-detected from file paths):
- `client` - Client PWA package
- `admin` - Admin dashboard package
- `shared` - Shared package (hooks, utils)
- `contract` - Smart contracts
- `indexer` - Envio indexer
- `agent` - Telegram/Discord bot agent

Issues are automatically added to the **Green Goods** project board.

**Full Guide:** `.claude/docs/gh-ticket-guide.md`

### Available Agents (5)

| Agent | Purpose |
|-------|---------|
| `code-reviewer` | 6-pass ultra-critical review, auto-posts to GitHub |
| `cracked-coder` | Elite implementation specialist |
| `engineering-lead` | Strategic coordinator |
| `infrastructure-architect` | System design guidance |
| `oracle` | Deep research agent |

### Enabled Plugins (13)

- `typescript-lsp` - TypeScript language server
- `github` - GitHub integration
- `figma` - Figma design extraction
- `vercel` - Vercel deployment
- `playwright` - E2E testing
- `code-review` - PR review workflow
- `security-guidance` - Security scanning
- `feature-dev` - Feature development
- `frontend-design` - UI/UX guidance
- `context7` - Context management
- `serena` - Code navigation
- `pr-review-toolkit` - 6-dimension PR analysis
- `hookify` - Custom hooks creation

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
