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

- **Node.js** v20+ • **bun** v9.x • **Docker** • **Foundry**

### Setup & Run

```bash
# Clone and install
git clone https://github.com/your-org/green-goods.git
cd green-goods
bun install

# Configure environment (REQUIRED - all packages use root .env)
cp .env.example .env
# Edit .env with your API keys (see .env.example)

# Start all services (pm2: client, admin, indexer)
bun dev

# Tail logs
bun exec pm2 logs client
bun exec pm2 logs admin
bun exec pm2 logs indexer
```

## ⚙️ Environment Configuration

**All packages use a single root `.env` file for configuration** — no package-level `.env` files are used.

### Key Environment Variables

```bash
# Client & Admin (Vite)
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_CHAIN_ID=42161                     # Default chain (84532=Base Sepolia, 42161=Arbitrum, 42220=Celo)
VITE_ENVIO_INDEXER_URL=http://localhost:8080/v1/graphql
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
VITE_PINATA_JWT=your_pinata_jwt

# Contracts (Foundry)
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
CELO_RPC_URL=https://forno.celo.org
ETHERSCAN_API_KEY=your_etherscan_api_key

# Indexer (Envio)
# Most config in packages/indexer/config.yaml
# Add any overrides here if needed
```

**How it works:**
- Vite packages (client, admin) load `.env` via `vite.config.ts`
- Contracts load `.env` via deployment scripts and `foundry.toml`
- Indexer loads `.env` via Docker Compose and scripts
- All commands (dev, build, deploy) automatically reference root `.env`

See [Environment Setup Guide](./docs/ENVIRONMENT_SETUP.md) for detailed configuration.

## 🛠️ Development

### Essential Commands

```bash
# Development
bun dev                              # Start all services
bun --filter <package> dev           # Start individual service

# Building  
bun build                            # Build all packages
bun --filter <package> build         # Build specific package

# Smart Contracts
bun --filter contracts test             # Test contracts
bun --filter contracts deploy:local     # Deploy locally
bun --filter contracts deploy:testnet   # Deploy to testnet
bun --filter contracts deploy:arbitrum  # Deploy to Arbitrum
bun --filter contracts deploy:celo      # Deploy to Celo mainnet

# Quality
bun format && bun lint && bun test # Quality checks
```

## 🤝 Contributing

1. **Fork** → **Branch** → **Code** → **Test** → **PR**
2. Use [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`
3. Git hooks auto-format and lint on commit/push

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design and architecture |
| [Deployment](./docs/DEPLOYMENT.md) | Contract deployment guide |
| [Karma GAP](./docs/KARMA_GAP.md) | Impact attestation integration |
| [Upgrades](./docs/UPGRADES.md) | UUPS upgrade guide |
| [Testing](./docs/TESTING.md) | E2E and contract testing |
| [Features](./docs/FEATURES.md) | Core platform features |
| [Gas Limits](./docs/GAS_LIMITS.md) | Gas optimization guide |
| [Production Readiness](./docs/PRODUCTION_READINESS.md) | Production deployment checklist |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Common issues and solutions |

**Package docs:** [client](./packages/client/README.md) • [admin](./packages/admin/README.md) • [indexer](./packages/indexer/README.md) • [contracts](./packages/contracts/README.md)

---

**Stack:** React • Node.js • Solidity • GraphQL • TypeScript  
**Tools:** Biome • 0xlint • Solhint • Playwright • Foundry

**License:** MIT • **Setup:** [Environment Guide](./docs/ENVIRONMENT_SETUP.md)
