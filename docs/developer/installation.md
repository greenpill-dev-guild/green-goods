# Installation & Environment Setup

Complete setup guide for local Green Goods development.

---

## Prerequisites

### Required

- **Node.js**: v20+ ([nodejs.org](https://nodejs.org))
- **Bun**: v1.0+ ([bun.sh](https://bun.sh))
- **Git**: Version control
- **Docker Desktop**: For indexer ([docker.com](https://www.docker.com/products/docker-desktop/))

### Blockchain Development

- **Foundry**: Forge, Cast, Anvil ([getfoundry.sh](https://getfoundry.sh))

### Optional

- **MetaMask**: For operator testing
- **VS Code**: Recommended editor with Biome extension

---

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
```

### 2. Install Dependencies

```bash
bun install
```

Installs all packages: client, admin, indexer, contracts.

### 3. Configure Environment

```bash
cp .env.example .env
```

**Edit `.env`** with required keys:

```bash
# Client - Required
VITE_WALLETCONNECT_PROJECT_ID=your_reown_project_id
VITE_PIMLICO_API_KEY=your_pimlico_key
VITE_CHAIN_ID=84532  # Base Sepolia default

# Contracts - Optional for running client
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Optional
VITE_PINATA_JWT=your_pinata_jwt
ETHERSCAN_API_KEY=your_etherscan_key
```

**Get API Keys**:
- Reown: [cloud.reown.com](https://cloud.reown.com/)
- Pimlico: [dashboard.pimlico.io](https://dashboard.pimlico.io/)
- Pinata: [app.pinata.cloud](https://app.pinata.cloud/)

### 4. Start Development

```bash
bun dev
```

Services start:
- Client: https://localhost:3001
- Admin: http://localhost:3002  
- Indexer: http://localhost:8080

---

## Package-Specific Setup

### Client

```bash
bun --filter client dev
```

**HTTPS Localhost**: Uses mkcert for PWA testing.

### Admin

```bash
bun --filter admin dev
```

### Indexer

**Ensure Docker running first**:
```bash
open -a Docker  # macOS
# Wait 30 seconds
bun --filter indexer dev
```

### Contracts

**Import keystore (one-time)**:
```bash
cast wallet import green-goods-deployer --interactive
```

**Compile**:
```bash
bun --filter contracts build
```

**Test**:
```bash
bun --filter contracts test
```

---

## Verification

**Check services**:
```bash
bun exec pm2 status
```

**View logs**:
```bash
bun exec pm2 logs client
```

**Stop all**:
```bash
bun dev:stop
```

---

## Troubleshooting

**Port conflicts**:
```bash
lsof -i :3001  # Find process
kill -9 <PID>  # Kill it
```

**Docker issues**:
```bash
bun --filter indexer reset
```

**Dependency issues**:
```bash
rm -rf node_modules bun.lock
bun install
```

---

## Learn More

- [Developer Quickstart](../welcome/quickstart-developer.md)
- [Monorepo Structure](architecture/monorepo-structure.md)
- [Testing Guide](testing.md)
- [Root README](../../README.md)

