# Green Goods — Agent Guide

This document provides AI agents with essential context about the Green Goods monorepo architecture, conventions, and development patterns.

## Project Overview

Green Goods is a decentralized platform for biodiversity conservation, enabling Garden Operators and Gardeners to document and verify conservation work through blockchain attestations.

**Tech Stack:** React · TypeScript · Solidity · GraphQL · Viem · EAS · Envio

**Tools:** Biome (35x faster) · 0xlint (30ms) · bun · Foundry

## Monorepo Structure

```
green-goods/
├── packages/
│   ├── client/          # React PWA — offline-first gardener/operator app
│   ├── admin/           # Admin dashboard — garden & contract management
│   ├── indexer/         # Envio GraphQL indexer — blockchain data
│   └── contracts/       # Solidity contracts — EAS integration, TBA accounts
├── docs/                # Architecture, deployment, testing guides
├── tests/               # E2E Playwright tests
└── .env                 # ROOT ENV — loaded by ALL packages
```

### Package Purposes

**Use `client/` when:**
- Building gardener/operator features
- Implementing offline-first workflows
- Creating PWA functionality
- Adding authentication flows

**Use `admin/` when:**
- Building administrative tools
- Creating garden management UIs
- Implementing role-based access
- Adding contract deployment features

**Use `indexer/` when:**
- Adding new GraphQL entities
- Processing blockchain events
- Exposing chain data to frontends
- Creating custom queries

**Use `contracts/` when:**
- Writing smart contract logic
- Defining EAS schemas
- Creating attestation resolvers
- Implementing on-chain governance

## Critical Cross-Package Rules

### 1. Environment Variables (MANDATORY)

**✅ ALWAYS:** Use root `.env` for ALL environment variables

**❌ NEVER:** Create package-specific `.env` files

**Why:** Ensures consistency across all packages. Deployment scripts, frontends, and indexer all share same configuration.

**Example:**
```bash
# Root .env (correct)
VITE_CHAIN_ID=84532
PRIVATE_KEY=0x...
ALCHEMY_API_KEY=...

# packages/client/.env (WRONG - never do this)
```

### 2. Chain Selection (MANDATORY)

**✅ ALWAYS:** Use `VITE_CHAIN_ID` environment variable via `getDefaultChain()`

**❌ NEVER:** Inspect `wallet.chainId` or allow runtime chain switching

**Why:** Green Goods apps are single-chain deployments. Dynamic switching creates data consistency issues.

**Example:**
```typescript
// Correct
import { getDefaultChain, DEFAULT_CHAIN_ID } from '@/config/blockchain';
const chainId = DEFAULT_CHAIN_ID; // Reads VITE_CHAIN_ID

// Wrong
const chainId = useAccount().chainId; // Never use wallet chain
```

### 3. Contract Deployment (MANDATORY)

**✅ ALWAYS:** Use `deploy.js` wrapper for all deployments

**❌ NEVER:** Run raw `forge` commands for deployment

**Why:** deploy.js ensures proper env loading, deterministic addresses, schema deployment, and error recovery.

**Example:**
```bash
# Correct
bun deploy:testnet
node script/deploy.js core --network baseSepolia --broadcast

# Wrong
forge script script/Deploy.s.sol --broadcast --rpc-url $RPC
```

### 4. Schema Configuration (CRITICAL)

**✅ NEVER MODIFY:** `packages/contracts/config/schemas.json`

**Why:** This file defines production EAS schemas deployed on-chain. Modifying it creates duplicate schemas with wrong metadata, breaks indexer queries, and makes historical attestations unfindable.

**If you need test schemas:** Create `schemas.test.json` instead

## Tech Stack Rationale

### Biome (vs Prettier)
- **35x faster** formatting
- Built-in linting rules
- Single tool for format + lint
- Native TypeScript support

### 0xlint (vs ESLint)
- **30ms** on entire codebase
- Rust-based performance
- Zero config needed
- Complements Biome

### bun (vs npm/pnpm)
- **2-10x faster** installs and script execution
- Native TypeScript support
- Built-in test runner
- Workspace support with --filter
- Smaller lock files (binary format)

### Viem (vs ethers)
- TypeScript-first design
- Tree-shakeable
- Smaller bundle size
- Modern async/await

## MCP Tool Usage

Green Goods has project-level MCP servers configured. Use them when appropriate.

### Available MCP Servers

**GitHub MCP:**
- Creating/updating issues
- Managing pull requests
- Querying repo state
- Reviewing code

**Playwright MCP:**
- Visual regression testing
- Screenshot comparisons
- E2E test validation
- PWA testing

**Filesystem MCP:**
- Large file operations
- Bulk directory analysis
- Cross-package searches

**Vercel MCP:**
- Deployment management
- Preview URL generation
- Build status checks

**Figma MCP:**
- Generate UI code from Figma designs
- Create screenshots of Figma components
- Extract design tokens and styles
- Build component libraries from design files
- Access Figma metadata for documentation

### When to Use MCP vs Native Tools

**Use MCP Tools:**
```bash
# GitHub operations
@github: Create issue for bug in WorkDashboard offline sync
@github: List open PRs tagged with "contracts"

# Visual testing
@playwright: Run E2E test for garden creation flow
@playwright: Compare screenshots before/after UI change

# Design to code
@figma: Generate React component code from Figma node [fileKey] [nodeId]
@figma: Create screenshot of Figma design for documentation

# Large operations
@filesystem: Find all uses of deprecated usePrivy hook
```

**Use Native Tools:**
```bash
# Simple file ops
grep "usePrivy" packages/client/src -r

# Code generation
# Write components, hooks, tests directly

# Business logic
# Implement features without MCP delegation
```

### Green Goods-Specific MCP Use Cases

**Figma for UI Component Development:**
```bash
# When designers share Figma mockups for new features
@figma: Generate WorkCard component code from Figma design [fileKey] [nodeId]
@figma: Extract color tokens from GardenCard design

# For documentation
@figma: Screenshot Figma prototype for feature documentation
@figma: Get component metadata for README
```

**Playwright for Offline-First Testing:**
```bash
# Test PWA offline behavior
@playwright: Run work submission flow with network offline
@playwright: Validate job queue sync after reconnection

# Visual regression on key flows
@playwright: Compare garden detail page before/after state management refactor
```

**Filesystem for Monorepo Maintenance:**
```bash
# Audit environment variable usage
@filesystem: Find all .env files in packages subdirectories

# Track deployment artifact imports
@filesystem: List all imports of deployment JSON across client and admin

# Validate schema protection
@filesystem: Check if config/schemas.json was modified
```

### MCP Auto-run Settings

**Enable auto-run for:**
- GitHub read operations (queries, issue lists)
- Playwright read operations (screenshot capture)
- Filesystem read operations (searches)
- Figma read operations (screenshots, metadata)

**Require approval for:**
- GitHub write operations (creating issues, PRs)
- Playwright test execution
- Filesystem write operations
- Figma code generation (review before applying)

## Development Workflow

### Getting Started
```bash
# First time setup
git clone <repo>
cd green-goods
bun install

# Copy root .env
cp .env.example .env
# Edit .env with your keys

# Start all services
bun dev

# View logs
bunx pm2 logs client
bunx pm2 logs admin
bunx pm2 logs indexer
```

### Quality Commands
```bash
# Format (Biome)
bun format

# Lint (0xlint + Biome)
bun lint

# Test all packages
bun test

# Build all packages
bun build
```

### Conventional Commits
```bash
# Format: <type>(<scope>): <description>

feat(client): add offline work submission queue
fix(contracts): resolve storage gap in GardenToken upgrade
docs(indexer): add GraphQL query examples
chore(admin): update dependencies
test(client): add job queue integration tests
```

## Testing Philosophy

### Coverage Targets
- **Client**: 80%+ for offline-first features (job queue, sync, dedup)
- **Admin**: 70%+ for workflows and role logic
- **Contracts**: 80% for testnet, 100% for mainnet
- **Integration**: Cover critical user flows end-to-end

### Testing Strategy
- **Unit tests**: Components, hooks, utils (Vitest)
- **Integration tests**: Multi-component workflows (Vitest + MSW)
- **E2E tests**: Full user journeys (Playwright)
- **Contract tests**: Logic + gas optimization (Foundry)

### Test-Driven Development
When adding features:
1. Write failing test first
2. Implement minimum code to pass
3. Refactor for quality
4. Document patterns in relevant .mdc rule

## Documentation Standards

### Code Documentation
- Top-of-file JSDoc for modules explaining purpose
- Inline comments for complex logic
- TypeScript types as documentation
- Examples in comments when non-obvious

### README Updates
When adding major features:
- Update package README
- Add to root README if cross-cutting
- Update relevant `/docs/` guides
- Add examples to AGENTS.md or .mdc rules

### Rule File Updates
When establishing new patterns:
- Add to relevant .mdc file (or create new if distinct)
- Keep under 500 lines per rule
- Include code examples
- Document anti-patterns

## Package-Specific Quick Links

**Client Deep Dive:**
- See `packages/client/AGENTS.md` for offline-first architecture
- See `packages/client/.cursor/rules/` for detailed patterns

**Admin Deep Dive:**
- See `packages/admin/AGENTS.md` for role-based access patterns
- See `packages/admin/.cursor/rules/` for XState workflows

**Indexer Deep Dive:**
- See `packages/indexer/AGENTS.md` for Envio conventions

**Contracts Deep Dive:**
- See `packages/contracts/.cursor/rules/production-readiness.mdc` for deployment checklist
- See `packages/contracts/.cursor/rules/schema-management.mdc` for schema immutability rules

## Common Patterns

### Cross-Package Imports
```typescript
// Correct — import from contracts deployment artifacts
import deployment from '../../../contracts/deployments/84532-latest.json';

// Correct — import from contracts network config
import networks from '../../../contracts/deployments/networks.json';

// Wrong — don't duplicate config
const GARDEN_TOKEN = '0x...'; // Use deployment.gardenToken instead
```

### Error Handling
```typescript
// Client/Admin pattern
try {
  await operation();
  toast.success('Success message');
} catch (err) {
  console.error('[Context] Error:', err);
  toast.error(err instanceof Error ? err.message : 'Operation failed');
}

// Contract pattern
if (condition) revert CustomError();
emit EventOccurred(params);
```

### TypeScript Strictness
- All packages use `"strict": true`
- No `any` types without explicit comment justification
- Prefer `unknown` for untrusted data
- Use type guards for narrowing

## Getting Help

**For AI Agents:**
1. Check relevant .mdc rule file first
2. Check package AGENTS.md
3. Check root AGENTS.md
4. Search codebase for similar patterns
5. Use MCP tools when appropriate (GitHub for context, Playwright for testing)

**For Humans:**
- Discord: [Link to Green Goods Discord]
- GitHub Issues: Create with `@github` MCP tool
- Email: greengoods@greenpill.builders

## Version History

- **2025-10-10**: Initial agent guide created with MCP integration
- **Current State**: Standardized rules across all packages

---

**Next Steps for Agents:**
- Review package-specific AGENTS.md for deeper context
- Check .cursor/rules/ for auto-attached MDC files
- Use MCP tools for repo operations and testing
- Follow conventional commits and quality standards

