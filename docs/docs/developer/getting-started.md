# Overview for Builders

Green Goods is an open-source, monorepo platform for verifiable regenerative impact. Built for developers who want to integrate, extend, or contribute.

---

## Getting Started

### 1. Environment Setup

You have two options: **Dev Container** (recommended) or **Local Setup**.

#### Option A: Dev Container (Recommended)

[![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/greenpill-dev-guild/green-goods)

This provides a pre-configured environment with Node, Bun, Foundry, and Docker-in-Docker.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and [VS Code](https://code.visualstudio.com/).
2. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
3. Open the repo in VS Code and click **"Reopen in Container"**.
4. Edit `.env` with your keys.
5. Run `bun dev`.

#### Option B: Local Setup

**Prerequisites:**
- Node.js 20+
- Bun 1.0+
- Git
- Docker Desktop (for indexer)
- Foundry (for contracts)

**Steps:**
1. Clone the repo
2. Run `bun setup`
3. Edit `.env`
4. Run `bun dev`

---

## Monorepo Structure

```
green-goods/
├── packages/
│   ├── client/          # React PWA (gardener app)
│   ├── admin/           # React dashboard (operator app)
│   ├── indexer/         # Envio GraphQL
│   └── contracts/       # Solidity + Foundry
├── docs/                # GitBook documentation
├── .env                 # Shared environment (all packages)
└── package.json         # Workspace scripts
```

**Managed with**: Bun workspaces
**Orchestrated with**: PM2 (for dev services)

[Detailed Architecture →](./architecture)

---

## Tech Stack

### Frontend

**Client (PWA)**:
- React 19 + TypeScript + Vite
- TanStack Query + Zustand
- Tailwind CSS v4 + Radix UI
- Offline-first (IndexedDB + Service Worker)

**Admin (Dashboard)**:
- React 19 + TypeScript + Vite
- Urql (GraphQL) + XState + Zustand
- Tailwind CSS v4 + Radix UI

### Backend

**Indexer**:
- Envio HyperIndex
- PostgreSQL (Docker)
- GraphQL API
- ReScript event handlers

### Blockchain

**Contracts**:
- Solidity 0.8.20
- Foundry (Forge, Cast, Anvil)
- OpenZeppelin (UUPS upgrades)
- EAS integration

**Networks**:
- Arbitrum One (42161)
- Celo (42220)
- Base Sepolia (84532)

### Infrastructure

**Storage**: IPFS via Storacha (primary) + Pinata (redundancy)
**Auth**: Pimlico smart accounts + Reown AppKit
**Attestations**: EAS (Ethereum Attestation Service)
**Deployment**: Decentralized via IPFS ([deployment guide](ipfs-deployment))

---

## Key Repositories

**GitHub**: https://github.com/greenpill-dev-guild/green-goods

**License**: MIT (open source)

**Branches**:
- `main`: Production
- `develop`: Active development
- Feature branches: `feat/feature-name`

---

## Development Philosophy

### Offline-First

Client designed for remote areas without reliable connectivity:
- Local-first storage (IndexedDB)
- Background sync
- Job queue system
- Resilient to network failures

### Mobile-First

Gardener app optimized for smartphones:
- Touch-friendly UI
- Camera integration
- Minimal typing
- Fast performance

### Open & Composable

All data publicly accessible:
- Open source code
- Public GraphQL API
- On-chain attestations
- Composable with other protocols

### Quality Standards

- TypeScript strict mode
- 70%+ test coverage (critical paths &gt;80%)
- E2E smoke tests pass (Playwright)
- Biome formatting + 0xlint
- Conventional commits
- Pre-commit hooks

---

## Quick Links

**Packages**:
- [Client Package Docs](./client)
- [Admin Package Docs](./admin)
- [Indexer Package Docs](./indexer)
- [Contracts Package Docs](./contracts)

**Getting Started**:
- [Installation Guide](installation)
- [Developer Quickstart](../welcome/quickstart-developer)

**Development**:
- [Testing Guide](testing) - Unit, integration, and E2E tests
- [E2E Test Reference](https://github.com/greenpill-dev-guild/green-goods/tree/main/tests#readme) - Playwright quick start
- [API Reference](api-reference)
- [Contributing Guide](contributing)

---

## Community

- 💬 **Chat**: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 🐙 **GitHub**: [Repo](https://github.com/greenpill-dev-guild/green-goods)
- 🐛 **Issues**: [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)
- 📋 **Project Board**: [DevSpot](https://devspot.app/en/projects/466)

