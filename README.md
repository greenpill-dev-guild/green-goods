# Green Goods

[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](https://github.com/greenpill-dev-guild/green-goods/releases/tag/v0.4.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Bringing community and environmental actions onchain to better measure, track and reward impact.**

Green Goods is an offline-first platform for documenting ecological and social work and proving impact on-chain. Operators approve gardener submissions, and the protocol anchors results in Ethereum attestation infrastructure.

## Quick Start

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
npm run setup                         # First-clone bridge: deps, Bun install, .env
bun run dev:doctor -- --profile web   # Non-mutating web readiness check
bun run dev:web                       # Starts client, admin, and docs via PM2
bun run dev:smoke:web                 # Confirms client/admin/docs respond locally
```

After setup, use `bun` for repo scripts and package operations. `npm run setup` is the only documented npm entrypoint, because fresh machines may not have Bun yet.

**Prereqs:** Node 22+, Bun, and Git. Docker is needed for full-stack/indexer work. Foundry is needed for contract work. macOS and Linux are supported natively; use WSL2 or a dev container on Windows.

For local development on the standard 1Password CLI, keep `OP_ENABLE_ENVIRONMENT_LOAD=false` and put root-only `op://...` references such as `ETHERSCAN_API_KEY_OP_REF=op://vault/item/field` in `.env`. CI and service-account flows can still use `OP_ENVIRONMENT` for bulk loading.

**Core local URLs:** Client PWA (`localhost:3001`) • Admin (`localhost:3002`) • Docs (`localhost:3003`) • Indexer (`localhost:8080`) • Storybook (`localhost:6006`)

**Dev stacks:**

- `bun run dev:web` — client, admin, docs. Best first target for frontend QA.
- `bun run dev:smoke:web` — runs the web doctor, then checks client/admin/docs health locally.
- `bun run dev:full` — full PM2 stack, including Docker-backed indexer, agent, tunnel, browser opener, and Storybook.
- `bun run dev:stop` — stop PM2-managed local services.

## Documentation

📖 **[docs.greengoods.app](https://docs.greengoods.app)** — Full documentation for users and developers

- [Developer Getting Started](https://docs.greengoods.app/builders/getting-started) — Setup, env bootstrap, local services, and first-run workflow
- [Prompting Green Goods](https://docs.greengoods.app/builders/agentic/prompting-green-goods) — Short repo-specific guide for working effectively with agents
- [Architecture](https://docs.greengoods.app/builders/architecture) — System design, boundaries, and diagrams
- [Builder API Index](https://docs.greengoods.app/builders/packages/api-index) — Package APIs, contracts, and shared surfaces
- [Operations](https://docs.greengoods.app/builders/operations) — Build, deploy, environment, and workflow references
- [How to Contribute](https://docs.greengoods.app/builders/how-to-contribute) — Contributor workflow and expectations

## AI-Assisted Development

If you are working in this repo with Codex, Claude Code, or another coding agent, start here:

- [ONBOARDING.md](./ONBOARDING.md) — paste into Claude Code on day one for a guided setup walkthrough
- [Prompting Green Goods](https://docs.greengoods.app/builders/agentic/prompting-green-goods) — the short prompt shape that matches this repo
- [AGENTS.md](./AGENTS.md) — runtime rules and repo invariants
- [CLAUDE.md](./CLAUDE.md) — commands, patterns, and working conventions

## Contributing

Run `bun format && bun lint && bun run test` before opening PRs.
