# Green Goods

Green Goods is a decentralized platform for biodiversity conservation, enabling Garden Operators and Gardeners to document and get approval for conservation work through blockchain-based attestations.

## 🏗️ Repository Structure

```
green-goods/
├── packages/
│   ├── client/           # React PWA frontend (Gardener/Operator app)
│   ├── admin/            # Admin dashboard (Garden & contract management)
│   ├── indexer/          # GraphQL blockchain indexer
│   └── contracts/        # Solidity smart contracts
├── docs/                 # Documentation
├── tests/                # End-to-end testing (Playwright)
└── scripts/              # Setup and utility scripts
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** v20+ • **pnpm** v9.x • **Docker** • **Foundry**

### Setup & Run

```bash
# Clone and install
git clone https://github.com/your-org/green-goods.git
cd green-goods
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see .env.example)

# Start all services (pm2: client, admin, indexer)
pnpm dev

# Tail logs
pnpm exec pm2 logs client
pnpm exec pm2 logs admin
pnpm exec pm2 logs indexer
```

## 🛠️ Development

### Essential Commands

```bash
# Development
pnpm dev                              # Start all services
pnpm --filter <package> dev           # Start individual service

# Building  
pnpm build                            # Build all packages
pnpm --filter <package> build         # Build specific package

# Smart Contracts
pnpm --filter contracts test          # Test contracts
pnpm --filter contracts deploy:sepolia # Deploy to testnet

# Quality
pnpm format && pnpm lint && pnpm test # Quality checks
```

## 🤝 Contributing

1. **Fork** → **Branch** → **Code** → **Test** → **PR**
2. Use [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`
3. Git hooks auto-format and lint on commit/push

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| [Environment Setup](./docs/ENVIRONMENT_SETUP.md) | API keys & configuration |
| [Testing](./docs/TESTING.md) | E2E testing guide |
| [Architecture](./docs/ARCHITECTURE.md) | System design |
| [Features](./docs/FEATURES.md) | Core platform features |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Common issues |

**Package docs:** [client](./packages/client/README.md) • [admin](./packages/admin/README.md) • [indexer](./packages/indexer/README.md) • [contracts](./packages/contracts/README.md)

---

**Stack:** React • Node.js • Solidity • GraphQL • TypeScript  
**Tools:** Biome • 0xlint • Solhint • Playwright • Foundry

**License:** MIT • **Setup:** [Environment Guide](./docs/ENVIRONMENT_SETUP.md)
