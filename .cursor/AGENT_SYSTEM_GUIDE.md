# Green Goods Agent System Guide

This document provides an overview of the complete agent documentation system for Green Goods.

## Agent Documentation Architecture

```
green-goods/
├── .cursor/
│   ├── mcp.json                      # MCP server configuration
│   └── rules/                        # Root-level MDC rules
│       ├── monorepo.mdc             # Always applied
│       ├── quality.mdc              # Always applied
│       ├── diagrams.mdc             # Always applied (Mermaid generation)
│       ├── orchestration.mdc        # Always applied (Cloud Agent dispatch)
│       ├── deployment.mdc           # Auto-attached to contracts/**
│       └── environment.mdc          # Auto-attached to .env*, config.*
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
- `/.cursor/rules/monorepo.mdc` — package structure and conventions
- `/.cursor/rules/quality.mdc` — testing and code quality standards
- `/.cursor/rules/diagrams.mdc` — Mermaid diagram generation guidance
- `/.cursor/rules/orchestration.mdc` — Cloud Agent dispatch and GitHub MCP orchestration
- `/packages/indexer/.cursor/rules/development.mdc` — indexer workflow

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

### Server Locations

| Server | Location | Why |
|--------|----------|-----|
| **GitHub** | Global config | Requires `GITHUB_TOKEN` secret; has write access |
| **Figma** | Project | Design file access, code generation |
| **Vercel** | Project | Deployment management |
| **Railway** | Project | Agent deployment |
| **Miro** | Project | Diagrams and boards |

### Two GitHub Integrations

| Integration | Purpose | Capabilities |
|-------------|---------|--------------|
| **GitHub MCP** (global) | In-editor orchestration | Read/write issues, PRs, comments |
| **GitHub App** (cloud) | Cloud Agents + Bugbot | Clone repos, push commits, open PRs |

**They work together:** MCP dispatches work → GitHub App executes Cloud Agents.

### Available MCP Tools

**GitHub (global, read+write):**
- Issue tracking and triage
- PR management and review
- **Post `@cursor` comments to spawn Cloud Agents**
- Create issues and PRs
- Code search across repos

**Figma:**
- UI code generation from designs
- Design screenshots
- Variable/token extraction

**Vercel:**
- Deployment management
- Preview URLs
- Build logs

**Miro:**
- Board access
- Diagram generation

**Railway:**
- Agent deployment
- Environment configuration
- Logs and monitoring

### MCP Usage Guidelines

**Orchestrate Cloud Agents:**
```bash
# Triage issues
@github: List open issues labeled "bug" in greenpill-dev-guild/green-goods

# Dispatch Cloud Agent to fix an issue
@github: Post comment on issue #123: "@cursor Investigate and fix this bug. Add a test first."

# Dispatch Bugbot auto-fix on a PR
@github: Post comment on PR #456: "@cursor fix"

# Track Cloud Agent PRs
@github: List PRs authored by cursor[bot] in greenpill-dev-guild/green-goods
```

**Other MCP tasks:**
```bash
@github: Create issue "Add dark mode" with labels: feature, client
@figma: Get design context for [fileKey] node [nodeId]
@vercel: Check deployment status for latest PR
@railway: View agent deployment logs
```

**Use native tools for:**
- Feature development (local agent)
- Component creation
- Business logic implementation

**See also:** [Cursor Workflows Guide](../docs/developer/cursor-workflows.md) for complete orchestration, dispatch templates, and Cloud vs Local agent guidance.

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

## Visual Documentation

Use Mermaid diagrams to clarify complex flows. Reference canonical diagrams instead of recreating them.

### Canonical Diagrams

Located in `docs/developer/architecture/diagrams.md`:

| Diagram | Use When |
|---------|----------|
| System Context | Package relationships, onboarding |
| Work Submission | Offline queue, client PRs |
| Work Approval | Admin PRs, resolver changes |
| Auth Flow | Auth-related PRs |
| Provider Hierarchy | Context nesting issues |
| E2E Test Flow | Test infrastructure |
| Deployment Flow | Contract deployment |
| Indexer Flow | Event processing |

### When to Generate Diagrams

- Cross-package flows (3+ packages affected)
- Multi-step workflows
- PR descriptions touching complex flows
- Answering "how does X work?" questions

### Diagram Generation Pattern

1. **Level 1 (detailed)**: Sequence diagram of specific function
2. **Level 2 (summary)**: Flowchart of component interactions
3. **Level 3 (context)**: System map showing packages

See `/.cursor/rules/diagrams.mdc` for full guidance.

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
- ✅ Orchestrate Cloud Agents via GitHub MCP
- ✅ Triage and dispatch multiple issues in parallel
- ✅ Integrate with n8n automated pipelines (meeting → issue → agent)

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
| Root | ✅ | 6 | Cross-package standards, diagrams, orchestration |
| Shared | ✅ | 7 | Hooks, providers, modules, stores |
| Client | ✅ | 8 | Components, views, PWA |
| Admin | ✅ | 4 | Access control, workflows |
| Indexer | ✅ | 2 | Envio conventions |
| Agent | ✅ | 5 | Multi-platform bot |
| Contracts | ✅ | 4 | Deployment, safety |

**Total:** 7 AGENTS.md files, 36 MDC rule files, 1 MCP config, 1 diagrams reference

---

**Last Updated:** 2025-01-01  
**Maintained by:** Green Goods core team  
**For questions:** greengoods@greenpill.builders
