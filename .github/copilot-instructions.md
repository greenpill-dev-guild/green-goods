# Green Goods Copilot Instructions

Use the existing Green Goods guidance model. `AGENTS.md`, package-local `AGENTS.md`, and the package-specific instruction files in `.github/instructions/` are the source of truth. Do not introduce a second rule system through Copilot-specific agents, skills, or UI-only guidance drift.

This repository's Copilot rollout is GitHub-native and CI/CD-first. Focus on pull request review, failing checks, code scanning, dependency risk, and security feedback. Do not expand this rollout into editor autocomplete, IDE setup, or new Copilot custom agents/skills.

Repo-wide invariants:

- Use `bun` for scripts and package operations. The only `npm` exception is `npm run setup` on a fresh machine before Bun is available.
- Use `bun run test`, never `bun test`.
- Never use raw `forge`; use the repo `bun` scripts for contract build, test, deploy, and upgrade flows.
- Keep reusable hooks, providers, stores, modules, and shared UI primitives in `@green-goods/shared`.
- Use the root `.env` only; do not add package-level `.env` files.
- Default to single-chain behavior through `getDefaultChain()` or `DEFAULT_CHAIN_ID`.
- Use the `Address` type for Ethereum addresses and `logger` from shared instead of `console.log`.
- Use Remixicon (`Ri*Line`), never lucide.
- Add every new user-facing string to `en`, `es`, and `pt`.
- Respect build dependency order: `contracts -> shared -> indexer -> client/admin/agent`.

For ambiguous, multi-package, or high-risk work, follow the same research-plan-implement loop as other agents: read the relevant source and package guidance, record evidence and open assumptions, surface human judgment points, then implement the smallest scoped change.

High-risk paths remain human-governed even when Copilot review runs automatically:

- deployment, verification, migration, and upgrade scripts
- `.env*`
- `.github/workflows/**`, Copilot instruction files, and dependency/security config
- `AGENTS.md`, `CLAUDE.md`, `.codex/**`, and `.claude/**`
- contract safety-critical surfaces and indexer schema/config changes

Use the lightest validation that proves the change:

- `node scripts/check-codex-consistency.js`
- `node scripts/ci-local.js --quick`
- `bun run format:check && bun lint`
- `bun run test`
- `VITE_CHAIN_ID=11155111 bun run build`

For pull request review, prioritize correctness, security, behavioral regression, risky config drift, and missing validation before style nits.
