# Green Goods

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/greenpill-dev-guild/green-goods/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Bringing community and environmental actions onchain to better measure, track and reward impact.**

Green Goods is an offline-first platform for documenting ecological and social work and proving impact on-chain. Operators approve gardener submissions, and the protocol anchors results in Ethereum attestation infrastructure.

## Getting Started

### Prerequisites

Install **Node.js 22+** and **Git**. Install **Docker Desktop** if you plan to run the full stack or indexer locally. Node includes `npm`, and `npm run setup` installs Bun automatically if it is missing.

**Optional tools:** Foundry is needed for contract work. `cloudflared` is useful for mobile-device PWA testing. macOS and Linux are supported natively; use WSL2 or a dev container on Windows.

### Clone

[![Clone on GitHub](https://img.shields.io/badge/Clone-on%20GitHub-2da44e?logo=github)](https://github.com/greenpill-dev-guild/green-goods)

Use GitHub's **Code** button to choose the SSH or HTTPS remote that matches your local Git setup. Then run the setup commands from the repo root.

### Agent-Assisted Setup

If you are using Codex, Claude Code, or another coding agent, start by loading [ONBOARDING.md](./ONBOARDING.md). It gives the agent the repo context, setup flow, environment model, and first-run checks before it starts changing files.

```text
Read ONBOARDING.md and AGENTS.md, then walk me through first-time setup for this repo.
Start with prerequisites, run npm run setup, check web readiness, start the browser
stack, and explain any env blockers before making changes.
```

### Setup

#### Install dependencies

```bash
npm run setup
```

After setup, use `bun` for repo scripts and package operations. `npm run setup` is the only documented npm entrypoint because fresh machines may not have Bun yet.

#### Environment defaults

Green Goods uses a single root `.env`, materialized from `.env.template` via the [1Password CLI](https://developer.1password.com/docs/cli/) (`op inject`). Bun, Vite, and Node read it natively — no per-command secret fetch.

```bash
bun run env:template:init   # one-time: scaffold .env.template from .env.schema
bun run env:sync             # materialize .env from .env.template (runs `op inject`)
bun run env:check            # validate .env satisfies .env.schema
```

`.env.schema` defines the contract; `.env.template` is the team-shared file with `op://Vault/Item/field` refs for shared secrets and plain values for non-secrets. Keep personal local-only credentials directly in `.env`.

| Variable | Needed for | Default setup state |
| --- | --- | --- |
| `APP_ENV` | Local tooling mode | Generated as `development` |
| `VITE_CHAIN_ID` | Client/admin chain selection | Generated for Sepolia |
| `VITE_ENVIO_INDEXER_URL` | Local indexer reads | Generated for local GraphQL; needs the indexer running for live local data |
| `VITE_PINATA_JWT` | Upload-capable media | Add only when testing uploads |
| `VITE_PIMLICO_API_KEY` | Passkey auth | Add only when testing passkey flows |
| `VITE_WALLETCONNECT_PROJECT_ID` | Wallet auth | Add only when testing wallet flows |
| `TELEGRAM_BOT_TOKEN` | Agent service | Add only when running a useful local agent |

For shared team secrets, edit `.env.template` and set the value to `op://Vault/Item/field`, then run `bun run env:sync`. For personal local credentials, set the variable directly in the root `.env`. Never create package-level `.env` files.

### Check readiness

```bash
bun run dev:doctor -- --profile web
```

### Start stack

```bash
bun run dev:web
```

Starts the four browser-based surfaces: client, admin, docs, and Storybook.

### Testing

```bash
bun run dev:smoke:web
```

Run this after the browser stack is starting.

## Tech Stack

### Stack Overview

- Node.js 22+ provides `npm` for first-clone setup.
- `npm run setup` installs Bun, installs dependencies, and creates the root `.env`.
- Bun is the workspace runtime after setup.
- `.env.schema` (key contract) + `.env.template` (1Password refs) materialize `.env` via `bun run env:sync` (`op inject`).
- PM2 manages local dev services.
- Docker powers full-stack indexer development.
- Storybook runs from the shared package.
- Full-stack work adds Docker-backed indexer services, the agent, tunnel, and workflow-specific env or secrets.

### Core Local URLs

Client and admin can start with generated defaults. Live data, uploads, authenticated onchain flows, and the local agent depend on the matching env and services.

| Surface | URL | Started by |
| --- | --- | --- |
| Client | <https://localhost:3001> | `bun run dev:web` or `bun run dev` |
| Admin | <https://localhost:3002> | `bun run dev:web` or `bun run dev` |
| Docs | <http://localhost:3003> | `bun run dev:web` or `bun run dev` |
| Storybook | <http://localhost:3004> | `bun run dev:web` or `bun run dev` |
| Agent | <http://localhost:3000/health> | `bun run dev` with configured agent env |
| Indexer | <http://localhost:3006/v1/graphql> | `bun run dev` with Docker running |

### Dev Commands

#### Start browser surfaces

```bash
bun run dev:web
```

Runs the four browser-based sites: client, admin, docs, and Storybook.

#### Start full local stack

Check full-stack readiness first:

```bash
bun run dev:doctor -- --profile full
```

Then start the full stack:

```bash
bun run dev
```

Use the full stack for Docker/indexer, agent, tunnel, or mobile-device PWA work. Run the full doctor first; some services need workflow-specific env or secrets before they are useful.

#### Stop local services

```bash
bun run dev:stop
```

## Contributing

### Guides

Read the [Greenpill Dev Guild contributing guide](https://github.com/greenpill-dev-guild/.github/blob/main/CONTRIBUTING.md) and the full [How to Contribute](https://docs.greengoods.app/builders/how-to-contribute) guide before opening a pull request.

### Before Pushing

Run each command from the repo root before pushing.

#### Check formatting

```bash
bun run format:check
```

#### Run lint

```bash
bun run lint
```

#### Run tests

```bash
bun run test
```

#### Build workspace

```bash
bun run build
```

### Funded Scoped Work

Paid implementation work is grant-dependent and must be clearly scoped with maintainers before work begins. Green Goods does not run open-ended bounties.

## Resources

### Documentation

- [Developer Getting Started](https://docs.greengoods.app/builders/getting-started) - setup, env bootstrap, local services, and first-run workflow
- [Architecture](https://docs.greengoods.app/builders/architecture) - system design, boundaries, and diagrams
- [Builder API Index](https://docs.greengoods.app/builders/packages/api-index) - package APIs, contracts, and shared surfaces
- [Operations](https://docs.greengoods.app/builders/operations) - build, deploy, environment, and workflow references
- [How to Contribute](https://docs.greengoods.app/builders/how-to-contribute) - contributor workflow and expectations

### Agent References

- [ONBOARDING.md](./ONBOARDING.md) - paste into Claude Code on day one for a guided setup walkthrough
- [AGENTS.md](./AGENTS.md) - runtime rules and repo invariants for Codex and other coding agents
- [CLAUDE.md](./CLAUDE.md) - Claude Code commands, patterns, and working conventions

### Community and Security

- [Code of Conduct](https://github.com/greenpill-dev-guild/.github/blob/main/CODE_OF_CONDUCT.md)
- [Security Policy](https://github.com/greenpill-dev-guild/.github/blob/main/SECURITY.md)
- [MIT License](./LICENSE)
