# Green Goods

Green Goods is an offline-first, single-chain platform for documenting conservation work and proving impact on-chain. Operators approve gardener submissions, and the protocol anchors the results in Ethereum attestation infrastructure.

## Quick Start

### Option A: Dev Container (Recommended)

[![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/greenpill-dev-guild/green-goods)

The fastest way to start is using VS Code Dev Containers (pre-configured environment):

1. **Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)** and **[VS Code](https://code.visualstudio.com/)**
2. **Open repository in VS Code**
3. **Click "Reopen in Container"** when prompted
4. **Run `bun dev`** inside the terminal

### Option B: Local Setup

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
bun setup                     # Checks deps, installs packages, creates .env from template

vi .env                       # Populate keys (Base Sepolia is the default chain: 84532)

bun dev                       # Starts client, admin, indexer via pm2
```

> **Note**: `bun setup` checks for required dependencies (Node 20+, Bun, Git, Docker, Foundry), installs them if possible, runs `bun install`, and copies `.env.example` to `.env`. If you prefer manual setup, see the [Installation Guide](https://docs.greengoods.app/developer/installation).

Useful follow-ups:

- `bun dev:stop` — stop the pm2 services
- `bun exec pm2 logs <service>` — stream logs for `client`, `admin`, or `indexer`

## Common Commands

```bash
# Format, lint, test across the workspace
bun format && bun lint && bun test

# Build everything or target a package
bun build
bun --filter client build

# Contracts: compile, test, deploy through the wrappers
bun --filter contracts build
bun --filter contracts test
bun --filter contracts deploy:testnet    # runs deploy.js with the correct profile
```

Scripts live in `package.json`; contract-specific flows are described in the Contracts Handbook.

## Documentation

📖 **[Full Documentation](https://docs.greengoods.app)** — Complete documentation for all users and developers

**Quick Links:**
- [Getting Started](https://docs.greengoods.app/developer/getting-started) — Environment setup, testing, troubleshooting
- [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook) — Deployment, upgrades, schema management
- [Architecture Diagrams](https://docs.greengoods.app/developer/architecture/diagrams) — Visual system overview
- [API Reference](https://docs.greengoods.app/developer/api-reference) — GraphQL APIs and smart contracts

**Run docs locally:**
```bash
bun docs:dev
```

Package-specific READMEs:
- `packages/client/README.md` — Offline-first PWA
- `packages/admin/README.md` — Operator dashboard
- `packages/indexer/README.md` — Envio indexer
- `packages/contracts/README.md` — Foundry project layout and scripts
- `packages/agent/README.md` — Multi-platform bot
- `packages/shared/README.md` — Common hooks and utilities

## Contributing

- Stick to conventional commits (`feat(client): …`)
- Run `bun format && bun lint && bun test` before opening PRs
- Keep environment-only secrets in the root `.env` and never add package-level `.env` files

For more project background, automation guidelines, and tooling policies see `AGENTS.md` and the package-specific agent guides.
