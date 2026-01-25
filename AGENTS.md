# Green Goods — Agent Guide

Reference for AI agents collaborating on the Green Goods monorepo (6 packages: client, admin, shared, indexer, contracts, agent).

## Core Principles

These universal programming principles guide all development in this codebase:

### DRY (Don't Repeat Yourself)

**How it's applied:**
- All React hooks centralized in `@green-goods/shared` — never duplicate across packages
- Single `queryKeys` factory — no ad-hoc query key strings
- Contract addresses from `deployments/*.json` — never hardcoded
- Toast presets (`workToasts`, `approvalToasts`) — consistent feedback patterns
- Date utilities (`formatDate`, `formatDateTime`) — single implementation

### KISS (Keep It Simple, Stupid)

**How it's applied:**
- Single chain per deployment (`VITE_CHAIN_ID`) — no runtime switching
- Single root `.env` file — no per-package overrides
- Fast tooling (Biome, oxlint) — simple configuration
- Deployment wrappers (`bun deploy:*`) — hide complex forge commands

### YAGNI (You Ain't Gonna Need It)

**How it's applied:**
- Don't add features until they're actually needed
- Don't build configuration options for hypothetical use cases
- Don't add backwards-compatibility shims — just change the code
- Delete unused code completely — no `_unused` prefixes or `// removed` comments

### Rule of Three

**When to refactor:**
- First time: Write the code
- Second time: Note the duplication
- Third time: Extract to a shared utility in `@green-goods/shared`

### Separation of Concerns

**Package boundaries:**
- `shared/` — All hooks, providers, stores, business logic
- `client/` and `admin/` — UI components and views only (no hooks)
- `contracts/` — On-chain logic only
- `indexer/` — Data indexing only

### SOLID Principles

**Single Responsibility:** Each hook does one thing (`useAuth` for auth, `useWorks` for work data)

**Open/Closed:** `queryKeys` factory is open for extension (add new key types) but closed for modification (existing keys don't change)

**Liskov Substitution:** Both auth modes (passkey/wallet) implement the same `useAuth` interface — consumers don't need to know which is used

**Interface Segregation:** Import only what you need (`import { useAuth }` not a giant `useEverything`)

**Dependency Inversion:** Hooks depend on abstractions (providers), not concrete implementations

### Development Best Practices

**Optimize for Deletion:** Design components that are easy to remove. If code is hard to delete, it's too coupled.

**Boy Scout Rule:** Always leave code a little better than you found it — fix a typo, improve a variable name while you're there.

**Self-Documenting Code:** Use clear names (`isOffline`, `addGardener`, `queryKeys.works.merged`). Comments explain "why", code explains "how".

**Test-Driven Development:** Write tests to define expected behavior. Coverage targets: 70-100% depending on package and criticality.

### Advanced TypeScript Patterns

- **Never `any`** — Use `unknown` and type guards
- **Discriminated unions** — Type-safe state handling with tagged unions
- **`as const`** — Preserve literal types for constants
- **AbortSignal** — Cancellable async operations
- **Zod schemas** — Runtime validation with type inference

See `CLAUDE.md` for detailed type system examples.

### Advanced Solidity Patterns

- **Checks-Effects-Interactions** — Prevent reentrancy
- **Pull-over-push payments** — Users withdraw, don't auto-distribute
- **Explicit visibility** — Always label functions and state variables
- **Fuzz + invariant testing** — Adversarial testing with Foundry
- **Multi-sig + timelock** — No single key for admin actions

See `.claude/context/contracts.md` for detailed patterns.

---

## Non-Negotiable Rules

- **Root `.env` only** — all packages read from the same file. Never introduce package-level env files or assume per-package overrides.
- **Single chain** — always derive the chain from `getDefaultChain()` / `DEFAULT_CHAIN_ID` (Base Sepolia `84532` by default). Never pivot off wallet chain IDs.
- **Deployment wrapper** — interact with contracts through `deploy.ts` and the bun scripts (`bun --filter contracts deploy:*`, `upgrade:*`). Raw `forge script … --broadcast` is reserved for debugging.
- **Schema immutability** — treat `packages/contracts/config/schemas.json` as read-only. Use `--update-schemas` via `deploy.ts` for metadata refreshes and create `schemas.test.json` for experiments.
- **Secrets discipline** — do not log or commit values from `.env`. Update `.env.example` alongside any required new variables.
- **Hooks in shared only** — all React hooks live in `@green-goods/shared`. Never create hooks in client or admin packages.
- **i18n completeness** — **ANY** new user-facing string MUST be added to ALL THREE language files (`packages/shared/src/i18n/{en,es,pt}.json`) simultaneously. Use `intl.formatMessage()` with semantic keys (e.g., `app.feature.action`). Never commit hardcoded UI strings.

## Codex Alignment (No Duplication)

To apply the Claude skills and rules in Codex without duplicating them, treat the Claude system as the canonical source of truth and reference it directly:

- `CLAUDE.md` — primary rules, architecture, and commands
- `.claude/skills/{plan,review,debug,audit}/SKILL.md` — authoritative workflows for `/plan`, `/review`, `/debug`, `/audit`
- `.claude/commands/*.md` — command triggers, usage, and output expectations
- `.claude/agents/*.md` — role behaviors (`oracle`, `cracked-coder`, `code-reviewer`)

When a task matches these workflows, open the relevant file(s) and follow them; do not restate or re-implement the rules here.

## MCP Usage

- **GitHub** — list/inspect issues and PRs freely; request approval before creating or editing content.
- **Figma** — safe for metadata and screenshots; code generation requires review.
- **Vercel** — deployment management and preview URLs.
- **Miro** — board access and diagram generation.
- **Railway** — agent deployment management.
- **Config** — MCP servers are defined in `.mcp.json` (single source of truth).

Default to local commands (rg, bun, forge) when the task is small. Escalate to MCP when you need cross-repo views, screenshots, or automated PR operations.

## Developer Onboarding

When helping a developer set up the project for the first time, recommend the **Dev Container** (Option A) for the most reliable experience, or the automated setup script (Option B).

### Option A: Dev Container (Best)
1. Install Docker Desktop + VS Code
2. Open repo in VS Code -> "Reopen in Container"
3. Edit `.env`
4. `bun dev`

### Option B: Local Shell
```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
bun setup
```

The `bun setup` command (`scripts/setup.js`):
1. Checks for Node.js 20+, Bun, Git (required) and Docker, Foundry (optional)
2. Auto-installs Bun if missing
3. Runs `bun install` to install all workspace packages
4. Creates `.env` from `.env.example`
5. Provides next-step guidance

After setup, the developer needs to:
1. Edit `.env` with API keys (Reown, Pimlico, optionally Storacha)
2. Run `bun dev` to start all services

For troubleshooting setup issues, see [Installation Guide](./docs/developer/installation.md).

## Workflow Checklist

1. **Before editing** — read the primary context files:
   - `CLAUDE.md` — primary context (architecture, patterns, commands)
   - `.claude/context/shared.md` — hooks, providers, stores, state patterns
   - `.claude/context/client.md` — offline architecture, authentication, components
   - `.claude/context/admin.md` — access control, role-based workflows
   - `.claude/context/contracts.md` — UUPS upgrades, deployment, schema management
   - `.claude/context/indexer.md` — Envio conventions, event handlers
   - `.claude/context/agent.md` — multi-platform bot architecture, security
2. **During implementation**
   - Keep TypeScript strict (`noImplicitAny`, etc.)
   - Prefer existing helper utilities over duplicating logic
   - Document non-obvious flows with concise comments
3. **Before handing off**
   - Run `bun format && bun lint && bun test` or the package-specific equivalent
   - Update documentation alongside behaviour changes (see `docs/developer/getting-started.md` and `docs/developer/contributing.md`, package READMEs)
   - Surface remaining risks, manual steps, or test gaps in the final message

## Common Patterns

- Import hooks, providers, and utilities from `@green-goods/shared` — don't duplicate logic across packages.
- Import deployment data from `packages/contracts/deployments/*.json` instead of hard-coding addresses.
- Use centralized query keys from `@green-goods/shared` for TanStack Query cache management.
- Use TanStack Query mutations with proper loading/error states; toast success/failure with actionable copy.
- Use toast presets from `@green-goods/shared` (`workToasts`, `approvalToasts`, `queueToasts`, `validationToasts`).
- Use date utilities from `@green-goods/shared` (`formatDate`, `formatDateTime`, `toDateTimeLocalValue`).
- Use `mediaResourceManager` from `@green-goods/shared` for blob URL lifecycle management.
- Contracts should revert with custom errors and emit events for state changes.
- Offline workflows persist to IndexedDB (see `packages/shared/src/modules/job-queue`); respect existing queue APIs when adding new flows.

## IPFS Deployment

Client and admin apps are deployed to IPFS via GitHub Actions (`.github/workflows/deploy-ipfs.yml`).

**Triggers:**
- Push to `main` → Production (Arbitrum)
- Push to `develop` → Staging (Base Sepolia)
- Pull requests → Preview deployment with PR comment

**Required GitHub Secrets:**
- `STORACHA_KEY` — Storacha signing key
- `STORACHA_PROOF` — UCAN delegation proof
- `PINATA_JWT` — Pinata JWT for redundancy

See [IPFS Deployment Guide](./docs/developer/ipfs-deployment.md) for setup and troubleshooting.

## Diagram-First Explanations

When explaining cross-package flows, reference or generate Mermaid diagrams:

- **Canonical diagrams:** `docs/developer/architecture/diagrams.md`

| Flow | Use When |
|------|----------|
| [System Context](docs/developer/architecture/diagrams.md#system-context) | Package relationships |
| [Work Submission](docs/developer/architecture/diagrams.md#work-submission) | Offline queue, client PRs |
| [Work Approval](docs/developer/architecture/diagrams.md#work-approval) | Admin PRs, resolver changes |
| [Auth Flow](docs/developer/architecture/diagrams.md#auth-flow) | Auth-related PRs |
| [Provider Hierarchy](docs/developer/architecture/diagrams.md#provider-hierarchy) | Context nesting issues |

For complex flows, start with a sequence diagram (detailed), then summarize to a flowchart (high-level).

## Reference Materials

- [Developer Docs](./docs/developer/getting-started.md) — environment, testing, troubleshooting
- [Contracts Handbook](./docs/developer/contracts-handbook.md) — deployment + upgrade playbooks
- [IPFS Deployment](./docs/developer/ipfs-deployment.md) — decentralized app deployment
- [Product Overview](./docs/features/overview.md) — architecture snapshot
- [Karma GAP Integration](./docs/developer/karma-gap.md) — GAP-specific context
- [Architecture Diagrams](./docs/developer/architecture/diagrams.md) — canonical Mermaid diagrams

When in doubt, check recent commits for precedent, or ask for clarification instead of guessing. Consistency across packages is the priority.
