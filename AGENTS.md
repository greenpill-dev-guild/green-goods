# Green Goods — Codex Guide

Primary runtime contract for Codex in this repository. Start here, then read the nearest
`AGENTS.md` for the package you are editing. Package-level guides override this file for
their subtree.

## Monorepo Map

- `packages/contracts` — Solidity contracts, deploy/upgrade wrappers, Foundry tests
- `packages/shared` — Shared hooks, providers, stores, modules, types, i18n, UI primitives
- `packages/client` — End-user web app
- `packages/admin` — Admin dashboard
- `packages/agent` — Bot/webhook service
- `packages/indexer` — Envio indexer

## Global Invariants

- Use `bun` for repo scripts and package operations. Do not introduce npm/yarn commands.
- Use `bun run test`, never `bun test`.
- Never use raw `forge`; use the repo's bun scripts for build, test, deploy, and upgrade flows.
- Hooks live in `@green-goods/shared` only.
- Use root `.env` only; do not add package-level `.env` files.
- Default to single-chain behavior through `getDefaultChain()` or `DEFAULT_CHAIN_ID`.
- Use the `Address` type for Ethereum addresses.
- Use `logger` from shared, never `console.log`.
- Use Remixicon (`Ri*Line`), never lucide.
- Any new user-facing string must be added to `en`, `es`, and `pt`.
- Respect build dependency order: contracts -> shared -> indexer -> client/admin/agent.

## Codex Workflow

1. Read the nearest `AGENTS.md`.
2. Keep the change inside the smallest sensible package boundary.
3. Run the lightest validation loop that still proves the change.
4. Escalate to cross-package verification when shared contracts, shared types, or public APIs move.

## Validation Ladder

- Codex drift check: `node scripts/check-codex-consistency.js`
- Quick repo verification: `node scripts/ci-local.js --quick`
- Test-quality guardrail: `bash scripts/check-test-quality.sh`
- Lint check: `bun run format:check && bun lint`
- Lint fix: `bun format && bun lint`
- Full tests: `bun run test`
- Full build: `VITE_CHAIN_ID=11155111 bun run build`

## Package Guides

- `packages/contracts/AGENTS.md`
- `packages/shared/AGENTS.md`
- `packages/client/AGENTS.md`
- `packages/admin/AGENTS.md`
- `packages/agent/AGENTS.md`
- `packages/indexer/AGENTS.md`

## Scope Constraints For Automated Maintenance

When Codex is running unattended maintenance work:

- Keep PRs to 20 changed files or fewer.
- Do not modify deployment scripts, contract upgrade scripts, or `.env` files.
- Do not create new packages or top-level directories.
- Do not modify agent operating docs (`AGENTS.md`, `.codex/**`, `CLAUDE.md`, `.claude/**`) unless the task explicitly asks for it.
- Keep automated PRs as drafts with the appropriate labels.

## Codex Config Surface

- Project config: `.codex/config.toml`
- Environment and actions: `.codex/environments/environment.toml`
- Reference doc: `docs/docs/builders/agentic/codex.mdx`
