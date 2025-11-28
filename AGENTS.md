# Green Goods — Agent Guide

Reference for AI agents collaborating on the Green Goods monorepo.

## Non-Negotiable Rules

- **Root `.env` only** — all packages read from the same file. Never introduce package-level env files or assume per-package overrides.
- **Single chain** — always derive the chain from `getDefaultChain()` / `DEFAULT_CHAIN_ID` (Base Sepolia `84532` by default). Never pivot off wallet chain IDs.
- **Deployment wrapper** — interact with contracts through `deploy.js` and the bun scripts (`bun --filter contracts deploy:*`, `upgrade:*`). Raw `forge script … --broadcast` is reserved for debugging.
- **Schema immutability** — treat `packages/contracts/config/schemas.json` as read-only. Use `--update-schemas` via `deploy.js` for metadata refreshes and create `schemas.test.json` for experiments.
- **Secrets discipline** — do not log or commit values from `.env`. Update `.env.example` alongside any required new variables.

## MCP Usage

- **GitHub** — list/inspect issues and PRs freely; request approval before creating or editing content.
- **Playwright** — approval required for running tests; reading screenshots is safe.
- **Filesystem** — use for repo-wide searches; ask for approval before bulk writes.
- **Figma** — safe for metadata and screenshots; code generation requires review.

Default to local commands (rg, bun, forge) when the task is small. Escalate to MCP when you need cross-repo views, screenshots, or automated PR operations.

## Workflow Checklist

1. **Before editing** — read relevant package agent guides:
   - `packages/client/AGENTS.md`
   - `packages/admin/AGENTS.md`
   - `packages/indexer/AGENTS.md`
   - `packages/telegram/AGENTS.md`
   - `packages/contracts/.cursor/rules/*`
2. **During implementation**
   - Keep TypeScript strict (`noImplicitAny`, etc.)
   - Prefer existing helper utilities over duplicating logic
   - Document non-obvious flows with concise comments
3. **Before handing off**
   - Run `bun format && bun lint && bun test` or the package-specific equivalent
- Update documentation alongside behaviour changes (see `docs/developer/getting-started.md` and `docs/developer/contributing.md`, package READMEs)
   - Surface remaining risks, manual steps, or test gaps in the final message

## Common Patterns

- Import deployment data from `packages/contracts/deployments/*.json` instead of hard-coding addresses.
- Use TanStack Query mutations with proper loading/error states; toast success/failure with actionable copy.
- Contracts should revert with custom errors and emit events for state changes.
- Offline workflows persist to IndexedDB (see `packages/client/src/modules/offline`); respect existing queue APIs when adding new flows.

## Reference Materials

- [Developer Docs](./docs/developer/getting-started.md) — environment, testing, troubleshooting
- [Contracts Handbook](./docs/developer/contracts-handbook.md) — deployment + upgrade playbooks
- [Product Overview](./docs/features/overview.md) — architecture snapshot
- [Karma GAP Integration](./docs/developer/karma-gap.md) — GAP-specific context

When in doubt, check recent commits for precedent, or ask for clarification instead of guessing. Consistency across packages is the priority.
