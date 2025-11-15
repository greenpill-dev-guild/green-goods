# Green Goods Agent System Guide

This document provides an overview of the complete agent documentation system for Green Goods.

## Agent Documentation Architecture

```
green-goods/
├── .cursor/
│   ├── mcp.json                      # MCP server configuration
│   └── rules/                        # Root-level MDC rules
│       ├── monorepo.mdc             # Always applied
│       ├── deployment.mdc           # Auto-attached to contracts/**
│       ├── environment.mdc          # Auto-attached to .env*, config.*
│       └── quality.mdc              # Always applied
├── AGENTS.md                         # Root agent guide (high-level)
└── packages/
    ├── client/
    │   ├── AGENTS.md                # Client architecture overview
    │   └── .cursor/rules/
    │       ├── offline-architecture.mdc   # Job queue, sync, storage
    │       ├── state-management.mdc       # TanStack Query, Zustand, RHF
    │       ├── component-patterns.mdc     # Cards, forms, Radix UI
    │       ├── hooks-conventions.mdc      # Hook naming, query keys
    │       ├── authentication.mdc         # Passkey, Pimlico, guards
    │       └── testing.mdc               # Vitest, Playwright MCP
    ├── admin/
    │   ├── AGENTS.md                # Admin architecture overview
    │   └── .cursor/rules/
    │       ├── access-control.mdc        # Role-based access
    │       ├── state-workflows.mdc       # Zustand + XState
    │       ├── graphql-integration.mdc   # Urql subscriptions
    │       ├── component-workflows.mdc   # Modals, forms
    │       └── testing.mdc              # Integration tests
    ├── indexer/
    │   ├── AGENTS.md                # Indexer overview
    │   └── .cursor/rules/
    │       ├── envio-conventions.mdc     # Entity patterns
    │       └── development.mdc          # Workflow, Docker
    └── contracts/
        ├── .cursorrules             # Legacy (to be migrated)
        └── .cursor/rules/
            ├── production-readiness.mdc  # Manual invocation
            ├── schema-management.mdc     # Immutable schemas
            ├── deployment-patterns.mdc   # deploy.js usage
            ├── uups-upgrades.mdc        # Storage gaps
            ├── testing-conventions.mdc   # Foundry tests
            └── gas-optimization.mdc     # Gas patterns
```

## Rule Activation Patterns

### Always Applied Rules

These rules are always in context:
- `/.cursor/rules/monorepo.mdc`
- `/.cursor/rules/quality.mdc`
- `/packages/indexer/.cursor/rules/development.mdc`

### Auto-Attached Rules

Rules auto-attach when working with matching files:

**Root-level:**
- `deployment.mdc` → `packages/contracts/**`
- `environment.mdc` → `**/.env*`, `**/config.*`

**Client:**
- `offline-architecture.mdc` → `modules/job-queue/**`, `modules/work/**`
- `state-management.mdc` → `providers/**`, `hooks/**`
- `component-patterns.mdc` → `components/**`, `views/**`
- `hooks-conventions.mdc` → `hooks/**`
- `authentication.mdc` → `providers/auth.tsx`, `hooks/auth/**`
- `testing.mdc` → `__tests__/**`, `**/*.test.*`

**Admin:**
- `access-control.mdc` → `hooks/useRole.ts`, `components/Require*.tsx`
- `state-workflows.mdc` → `stores/**`, `workflows/**`
- `graphql-integration.mdc` → `**/*.graphql`, urql imports
- `component-workflows.mdc` → `components/Garden/**`
- `testing.mdc` → `__tests__/**`

**Indexer:**
- `envio-conventions.mdc` → `schema.graphql`, `src/EventHandlers.ts`, `config.yaml`

**Contracts:**
- `schema-management.mdc` → `config/schemas.json`, `script/*Schema*.sol`
- `deployment-patterns.mdc` → `script/deploy.js`, `script/upgrade.js`
- `uups-upgrades.mdc` → `src/**/*Upgradeable.sol`, `test/*Upgrade*.sol`
- `testing-conventions.mdc` → `test/**`
- `gas-optimization.mdc` → `src/**/*.sol`

### Manual Invocation

Invoke these with `@rulename`:

```bash
# Invoke production readiness
@production-readiness

# Check if contracts ready for mainnet
@production-readiness: Assess readiness for Celo mainnet deployment
```

## MCP Server Configuration

Project-level MCP servers configured in `.cursor/mcp.json`:

### Available MCP Tools

**Filesystem:**
- Large file operations
- Cross-package searches
- Bulk directory analysis

**GitHub:**
- Issue tracking
- PR management
- Repo queries

**Playwright:**
- E2E test execution
- Visual regression testing
- Accessibility audits

**Vercel:**
- Deployment management
- Preview URLs
- Build status

**Figma:**
- UI code generation from designs
- Design screenshots for documentation
- Design token extraction
- Component metadata access

### MCP Usage Guidelines

**Use MCP for:**
```bash
@github: Create issue "Add garden search" with label feature, client
@playwright: Run E2E test for garden creation flow
@filesystem: Find all files importing from contracts/deployments
@figma: Generate component code from design [fileKey] [nodeId]
```

**Use native tools for:**
- Feature development
- Component creation
- Business logic implementation

## Critical Cross-Package Rules

These rules are enforced across ALL packages:

### 1. Root .env Only

**✅ DO:** Use `/Users/afo/Code/greenpill/green-goods/.env`
**❌ DON'T:** Create package-specific `.env` files

### 2. Chain from Environment

**✅ DO:** Use `VITE_CHAIN_ID` via `getDefaultChain()`
**❌ DON'T:** Read from wallet `chainId`

### 3. Deploy via deploy.js

**✅ DO:** `pnpm deploy:testnet` or `node script/deploy.js`
**❌ DON'T:** `forge script script/Deploy.s.sol`

### 4. Never Modify schemas.json

**✅ DO:** Create `schemas.test.json` for testing
**❌ DON'T:** Edit `config/schemas.json`

### 5. Centralized Query Keys

**✅ DO:** Use `queryKeys` from `hooks/query-keys.ts`
**❌ DON'T:** Construct ad-hoc query keys

## Package-Specific Priorities

### Client (Highest Complexity)

**Focus areas:**
- Offline-first architecture (job queue, sync, storage)
- State management (TanStack Query, Zustand, RHF)
- Component patterns (cards, forms, modals)
- Authentication (passkey, smart accounts)

**Rule count:** 6 MDC files + AGENTS.md

### Admin (Medium Complexity)

**Focus areas:**
- Role-based access control
- XState workflows
- GraphQL subscriptions
- Modal workflows

**Rule count:** 5 MDC files + AGENTS.md

### Indexer (Low Complexity)

**Focus areas:**
- Envio conventions
- Event handlers
- Multi-chain entities

**Rule count:** 2 MDC files + AGENTS.md

### Contracts (Medium Complexity)

**Focus areas:**
- Production readiness
- Schema immutability
- Deployment safety
- UUPS upgrades

**Rule count:** 6 MDC files

## Quality Baseline

All packages follow these standards:

- **TypeScript:** Strict mode, no `any` without justification
- **Formatting:** Biome (35x faster than Prettier)
- **Linting:** 0xlint (30ms on entire codebase)
- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`)
- **Testing:** 70%+ overall, 80%+ for critical paths
- **Documentation:** Update README and rules when establishing patterns

## Tool Preferences

**Formatting & Linting:**
- Biome over Prettier (performance)
- 0xlint over ESLint (speed)
- Solhint for Solidity

**Package Management:**
- pnpm over npm/yarn (workspace support)

**Blockchain:**
- Viem over ethers (TypeScript-first, smaller bundle)
- Foundry over Hardhat (speed, testing)

**State:**
- TanStack Query for server state
- Zustand for UI state
- React Hook Form for forms

## Getting Started as an Agent

1. Read root `AGENTS.md` for project overview
2. Review root `.cursor/rules/` for cross-package standards
3. Check package-specific `AGENTS.md` for architecture
4. Review package `.cursor/rules/` for detailed patterns
5. Use MCP tools when appropriate
6. Follow conventional commits
7. Update rules when establishing new patterns

## Agent Capabilities

With this documentation system, agents can:

- ✅ Build features following existing patterns
- ✅ Understand offline-first architecture
- ✅ Navigate role-based access correctly
- ✅ Deploy contracts safely
- ✅ Write consistent tests
- ✅ Use appropriate state management
- ✅ Follow code quality standards
- ✅ Leverage MCP tools effectively

## Maintenance

### Updating Rules

When to update agent documentation:

- **New pattern established:** Add to relevant .mdc file
- **Breaking change:** Update all affected rules
- **New package added:** Create AGENTS.md and .cursor/rules/
- **Major refactor:** Review and update related rules
- **User feedback:** Incorporate into rule improvements

### Rule File Limits

Keep each rule under 500 lines:
- Split large rules into focused files
- Use multiple .mdc files per concern
- Link related rules in "Reference Files" section

## Success Metrics

Agent documentation is successful when:

- New features follow established patterns automatically
- Fewer clarification questions about architecture
- Consistent code structure across contributions
- Faster onboarding for human developers
- Reduced rework from architectural misunderstandings

## Quick Reference

| Package | AGENTS.md | Rule Count | Focus |
|---------|-----------|------------|-------|
| Root | ✅ | 4 | Cross-package standards |
| Client | ✅ | 6 | Offline-first, state, auth |
| Admin | ✅ | 5 | Access control, workflows |
| Indexer | ✅ | 2 | Envio conventions |
| Contracts | ➖ | 6 | Deployment, safety |

**Total:** 5 AGENTS.md files, 23 MDC rule files, 1 MCP config

---

**Last Updated:** 2025-10-10  
**Maintained by:** Green Goods core team  
**For questions:** greengoods@greenpill.builders

