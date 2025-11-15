# Overview for Builders

Green Goods is an open-source, monorepo platform for verifiable regenerative impact. Built for developers who want to integrate, extend, or contribute.

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

[Detailed Architecture →](architecture/monorepo-structure.md)

---

## Tech Stack

### Frontend

**Client (PWA)**:
- React 18 + TypeScript + Vite
- TanStack Query + Zustand
- Tailwind CSS v4 + Radix UI
- Offline-first (IndexedDB + Service Worker)

**Admin (Dashboard)**:
- React 18 + TypeScript + Vite
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

**Storage**: IPFS via Pinata
**Auth**: Pimlico smart accounts + Reown AppKit
**Attestations**: EAS (Ethereum Attestation Service)

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
- 70%+ test coverage (critical paths >80%)
- Biome formatting + 0xlint
- Conventional commits
- Pre-commit hooks

---

## Quick Links

**Packages**:
- [Client Package Docs](architecture/client-package.md)
- [Admin Package Docs](architecture/admin-package.md)
- [Indexer Package Docs](architecture/indexer-package.md)
- [Contracts Package Docs](architecture/contracts-package.md)

**Getting Started**:
- [Installation Guide](installation.md)
- [Developer Quickstart](../welcome/quickstart-developer.md)

**Development**:
- [Testing Guide](testing.md)
- [API Reference](api-reference.md)
- [Contributing Guide](contributing.md)

---

## Community

- 💬 **Chat**: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 🐙 **GitHub**: [Repo](https://github.com/greenpill-dev-guild/green-goods)
- 🐛 **Issues**: [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)
- 📋 **Project Board**: [DevSpot](https://devspot.app/en/projects/466)

