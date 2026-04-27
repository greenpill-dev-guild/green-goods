# Green Goods

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/greenpill-dev-guild/green-goods/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Bringing community and environmental actions onchain to better measure, track and reward impact.**

Green Goods is an offline-first platform for documenting ecological and social work and proving impact on-chain. Operators approve gardener submissions, and the protocol anchors results in Ethereum attestation infrastructure.

## Quick Start

Before setup, install **Node.js 22+** and **Git**. Install **Docker Desktop** if you plan to run the full stack or indexer locally. Node includes `npm`, and `npm run setup` installs Bun automatically if it is missing.

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
npm run setup                         # Installs Bun if needed, installs deps, creates root .env
bun run dev:doctor -- --profile web   # Non-mutating web readiness check
bun run dev:web                       # Starts client, admin, and docs via PM2
bun run dev:smoke:web                 # Confirms client/admin/docs respond locally
```

After setup, use `bun` for repo scripts and package operations. `npm run setup` is the only documented npm entrypoint, because fresh machines may not have Bun yet.

**Optional tools:** Foundry is needed for contract work. `cloudflared` is useful for mobile-device PWA testing. macOS and Linux are supported natively; use WSL2 or a dev container on Windows.

**Core Local URLs**

| Surface | URL | Started by |
| --- | --- | --- |
| Client PWA | <http://localhost:3001> | `bun run dev:web` or `bun run dev:full` |
| Admin | <http://localhost:3002> | `bun run dev:web` or `bun run dev:full` |
| Docs | <http://localhost:3003> | `bun run dev:web` or `bun run dev:full` |
| Indexer GraphQL | <http://localhost:8080> | `bun run dev:full` |
| Storybook | <http://localhost:6006> | `bun run dev:full` |

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

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the full [How to Contribute](https://docs.greengoods.app/builders/how-to-contribute) guide before opening a pull request. Run `bun run format:check && bun run lint && bun run test` before pushing.

Paid implementation work is grant-dependent and must be clearly scoped with maintainers before work begins. Green Goods does not run open-ended bounties.

## Community and Security

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [MIT License](./LICENSE)
