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
    ├── shared/                       # Common code for client + admin
    │   ├── AGENTS.md                # Shared architecture overview
    │   └── .cursor/rules/
    │       ├── rules.mdc                 # Package conventions
    │       ├── cross-package-imports.mdc # Import patterns
    │       ├── hook-architecture.mdc     # All hooks live in shared
    │       ├── state-patterns.mdc        # Providers, stores, query keys
    │       ├── design-system.mdc         # Colors, typography, icons
    │       ├── testing-patterns.mdc      # Vitest, mocks, coverage
    │       └── appkit-integration.mdc    # Wallet connection
    ├── client/
    │   ├── AGENTS.md                # Client architecture overview
    │   └── .cursor/rules/
    │       ├── rules.mdc                 # Package conventions
    │       ├── offline-architecture.mdc  # Job queue, sync, storage
    │       ├── authentication.mdc        # Passkey, Pimlico, guards
    │       ├── component-cards.mdc       # Card patterns
    │       ├── component-forms.mdc       # Form patterns
    │       ├── component-modals.mdc      # Modal/drawer patterns
    │       ├── component-radix.mdc       # Radix UI primitives
    │       └── testing.mdc              # Vitest, Playwright MCP
    ├── admin/
    │   ├── AGENTS.md                # Admin architecture overview
    │   └── .cursor/rules/
    │       ├── rules.mdc                # Package conventions
    │       ├── access-control.mdc       # Role-based access
    │       ├── component-workflows.mdc  # Modals, forms
    │       └── testing.mdc             # Integration tests
    ├── indexer/
    │   ├── AGENTS.md                # Indexer overview
    │   └── .cursor/rules/
    │       ├── envio-conventions.mdc    # Entity patterns
    │       └── development.mdc         # Workflow, Docker
    ├── agent/
    │   ├── AGENTS.md                # Multi-platform bot overview
    │   └── .cursor/rules/
    │       ├── rules.mdc               # Package conventions
    │       ├── architecture.mdc        # Data flow, handlers
    │       ├── deployment.mdc          # Railway, Docker, webhooks
    │       ├── security.mdc            # Encryption, rate limiting
    │       └── testing.mdc            # Coverage targets
    └── contracts/
        ├── AGENTS.md                # Contracts overview
        └── .cursor/rules/
            ├── rules.mdc               # Solidity style, safety
            ├── schema-management.mdc   # Immutable schemas
            ├── deployment-patterns.mdc # deploy.ts usage
            └── uups-upgrades.mdc      # Storage gaps
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

**Shared:**
- `rules.mdc` → `packages/shared/src/**`
- `hook-architecture.mdc` → `packages/shared/src/hooks/**`
- `state-patterns.mdc` → `packages/shared/src/providers/**`, `packages/shared/src/stores/**`
- `cross-package-imports.mdc` → `packages/client/src/**`, `packages/admin/src/**`

**Client:**
- `rules.mdc` → `packages/client/src/**`
- `component-*.mdc` → `packages/client/src/components/**`, `packages/client/src/views/**`
- `testing.mdc` → `packages/client/src/__tests__/**`, `**/*.test.*`

**Admin:**
- `rules.mdc` → `packages/admin/src/**`
- `access-control.mdc` → `packages/admin/src/routes/Require*.tsx`
- `component-workflows.mdc` → `packages/admin/src/components/Garden/**`
- `testing.mdc` → `packages/admin/src/__tests__/**`

**Indexer:**
- `envio-conventions.mdc` → `schema.graphql`, `src/EventHandlers.ts`, `config.yaml`

**Agent:**
- `rules.mdc` → `packages/agent/src/**`
- `architecture.mdc` → `packages/agent/src/handlers/**`, `packages/agent/src/services/**`
- `security.mdc` → `packages/agent/src/services/encryption.ts`
- `deployment.mdc` → `packages/agent/Dockerfile`, `packages/agent/src/api/**`

**Contracts:**
- `rules.mdc` → `packages/contracts/src/**`
- `schema-management.mdc` → `packages/contracts/config/schemas.json`
- `deployment-patterns.mdc` → `packages/contracts/script/deploy.ts`
- `uups-upgrades.mdc` → `packages/contracts/src/**/*Upgradeable.sol`, `packages/contracts/test/*Upgrade*.sol`

### Manual Invocation

Invoke specific rules with `@rulename`:

```bash
# Check contract production readiness
@rules: Assess contracts for Celo mainnet deployment

# Review hook architecture
@hook-architecture: Review this custom hook implementation
```

## MCP Server Configuration

Project-level MCP servers configured in `.cursor/mcp.json`:

### Available MCP Tools

**GitHub:**
- Issue tracking
- PR management
- Repo queries

**Figma:**
- UI code generation from designs
- Design screenshots for documentation
- Design token extraction
- Component metadata access

**Vercel:**
- Deployment management
- Preview URLs
- Build status

**Miro:**
- Board access
- Diagram generation
- Context extraction

**Railway:**
- Agent deployment management
- Environment configuration
- Logs and monitoring

### MCP Usage Guidelines

**Use MCP for:**
```bash
@github: Create issue "Add garden search" with label feature, client
@figma: Generate component code from design [fileKey] [nodeId]
@vercel: Check deployment status for latest PR
@railway: View agent deployment logs
```

**Use native tools for:**
- Feature development
- Component creation
- Business logic implementation

## Critical Cross-Package Rules

These rules are enforced across ALL packages:

### 1. Root .env Only

**✅ DO:** Use root `.env` file
**❌ DON'T:** Create package-specific `.env` files

### 2. Chain from Environment

**✅ DO:** Use `VITE_CHAIN_ID` via `getDefaultChain()`
**❌ DON'T:** Read from wallet `chainId`

### 3. Deploy via deploy.ts

**✅ DO:** `bun deploy:testnet` or `bun script/deploy.ts`
**❌ DON'T:** `forge script script/Deploy.s.sol`

### 4. Never Modify schemas.json

**✅ DO:** Create `schemas.test.json` for testing
**❌ DON'T:** Edit `config/schemas.json`

### 5. Centralized Query Keys

**✅ DO:** Use `queryKeys` from `@green-goods/shared`
**❌ DON'T:** Construct ad-hoc query keys

### 6. Hooks Live in Shared (CRITICAL)

**✅ DO:** Create hooks in `packages/shared/src/hooks/`
**❌ DON'T:** Create hooks in client or admin packages

## Package-Specific Priorities

### Shared (Highest Complexity)

**Focus areas:**
- Offline-first architecture (job queue, sync, storage)
- State management (TanStack Query, Zustand, RHF)
- Authentication (passkey, smart accounts)
- Hooks, providers, stores, workflows
- Toast presets and utilities
- Date/time formatting utilities

**Rule count:** 7 MDC files + AGENTS.md

### Client (Medium Complexity)

**Focus areas:**
- Component patterns (cards, forms, modals)
- Views and routing
- PWA-specific features

**Rule count:** 8 MDC files + AGENTS.md

### Admin (Medium Complexity)

**Focus areas:**
- Role-based access control
- Garden management workflows
- Modal workflows

**Rule count:** 4 MDC files + AGENTS.md

### Indexer (Low Complexity)

**Focus areas:**
- Envio conventions
- Event handlers
- Multi-chain entities

**Rule count:** 2 MDC files + AGENTS.md

### Agent (Medium Complexity)

**Focus areas:**
- Multi-platform bot (Telegram, Discord, WhatsApp)
- Handler architecture
- Security (encryption, rate limiting)
- Railway deployment

**Rule count:** 5 MDC files + AGENTS.md

### Contracts (Medium Complexity)

**Focus areas:**
- Schema immutability
- Deployment safety
- UUPS upgrades
- Solidity style and safety

**Rule count:** 4 MDC files + AGENTS.md

## Quality Baseline

All packages follow these standards:

- **TypeScript:** Strict mode, no `any` without justification
- **Formatting:** Biome (35x faster than Prettier)
- **Linting:** oxlint (30ms on entire codebase)
- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`)
- **Testing:** 70%+ overall, 80%+ for critical paths
- **Documentation:** Update README and rules when establishing patterns

## Tool Preferences

**Formatting & Linting:**
- Biome over Prettier (performance)
- oxlint over ESLint (speed)
- Solhint for Solidity

**Package Management:**
- bun for workspace management

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
| Shared | ✅ | 7 | Hooks, providers, modules, stores |
| Client | ✅ | 8 | Components, views, PWA |
| Admin | ✅ | 4 | Access control, workflows |
| Indexer | ✅ | 2 | Envio conventions |
| Agent | ✅ | 5 | Multi-platform bot |
| Contracts | ✅ | 4 | Deployment, safety |

**Total:** 7 AGENTS.md files, 34 MDC rule files, 1 MCP config

---

**Last Updated:** 2025-01-01  
**Maintained by:** Green Goods core team  
**For questions:** greengoods@greenpill.builders
