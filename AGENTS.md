# Green Goods — Agent Guide

Reference for AI agents collaborating on the Green Goods monorepo (6 packages: client, admin, shared, indexer, contracts, agent).

## Non-Negotiable Rules

- **Root `.env` only** — all packages read from the same file. Never introduce package-level env files or assume per-package overrides.
- **Single chain** — always derive the chain from `getDefaultChain()` / `DEFAULT_CHAIN_ID` (Base Sepolia `84532` by default). Never pivot off wallet chain IDs.
- **Deployment wrapper** — interact with contracts through `deploy.ts` and the bun scripts (`bun --filter contracts deploy:*`, `upgrade:*`). Raw `forge script … --broadcast` is reserved for debugging.
- **Schema immutability** — treat `packages/contracts/config/schemas.json` as read-only. Use `--update-schemas` via `deploy.ts` for metadata refreshes and create `schemas.test.json` for experiments.
- **Secrets discipline** — do not log or commit values from `.env`. Update `.env.example` alongside any required new variables.
- **Hooks in shared only** — all React hooks live in `@green-goods/shared`. Never create hooks in client or admin packages.

## MCP Usage

- **GitHub** — list/inspect issues and PRs freely; request approval before creating or editing content.
- **Figma** — safe for metadata and screenshots; code generation requires review.
- **Vercel** — deployment management and preview URLs.
- **Miro** — board access and diagram generation.
- **Railway** — agent deployment management.

Default to local commands (rg, bun, forge) when the task is small. Escalate to MCP when you need cross-repo views, screenshots, or automated PR operations.

## Developer Onboarding

When helping a developer set up the project for the first time, recommend the automated setup:

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

1. **Before editing** — read relevant package agent guides:
   - `packages/shared/AGENTS.md` — common hooks, providers, stores, modules
   - `packages/client/AGENTS.md` — PWA views and components
   - `packages/admin/AGENTS.md` — dashboard views and components
   - `packages/indexer/AGENTS.md` — Envio GraphQL indexer
   - `packages/agent/AGENTS.md` — multi-platform bot (Telegram, Discord, WhatsApp)
   - `packages/agent/.cursor/rules/*.mdc` — agent architecture, testing, deployment, security
   - `packages/contracts/AGENTS.md` — Solidity contracts overview
   - `packages/contracts/.cursor/rules/*.mdc` — detailed contract patterns
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
- **Generation guide:** `.cursor/rules/diagrams.mdc`

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
- [Agent System Guide](./.cursor/AGENT_SYSTEM_GUIDE.md) — complete documentation architecture

When in doubt, check recent commits for precedent, or ask for clarification instead of guessing. Consistency across packages is the priority.
