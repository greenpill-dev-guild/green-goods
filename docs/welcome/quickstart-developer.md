# Developer Quickstart

Get the Green Goods monorepo running locally in 10 minutes. Start building on the regenerative impact protocol.

---

## What You'll Need

- 🖥️ macOS, Linux, or Windows (WSL2)
- 📦 [Bun](https://bun.sh) (v1.0+)
- 🔨 [Foundry](https://book.getfoundry.sh/getting-started/installation) (for contracts)
- 🐳 [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for indexer)
- 🔧 Git

**Optional but recommended**:
- 🦊 MetaMask or another web3 wallet
- 🔑 Test ETH on Base Sepolia ([faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))

---

## Step 1: Clone and Install

### 1.1 Clone the Repository

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
```

### 1.2 Install Dependencies

```bash
bun install
```

This installs all dependencies across the monorepo (client, admin, indexer, contracts).

**What's installed**:
- Frontend dependencies (React, Vite, TanStack Query)
- Smart contract tools (Solidity, Foundry)
- Indexer dependencies (Envio, ReScript)
- Development tools (Biome, 0xlint, Vitest)

---

## Step 2: Configure Environment

### 2.1 Create .env File

```bash
cp .env.example .env
```

### 2.2 Add Required Variables

Edit `.env` with your preferred editor:

```bash
# Required for client
VITE_WALLETCONNECT_PROJECT_ID=your_reown_project_id
VITE_PIMLICO_API_KEY=your_pimlico_api_key
VITE_CHAIN_ID=84532  # Base Sepolia for testing

# Required for contracts
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer  # After creating keystore
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Optional but recommended
VITE_PINATA_JWT=your_pinata_jwt  # For IPFS uploads
ETHERSCAN_API_KEY=your_etherscan_key  # For contract verification
```

**Get API Keys**:
- **Reown (WalletConnect)**: [cloud.reown.com](https://cloud.reown.com/)
- **Pimlico**: [dashboard.pimlico.io](https://dashboard.pimlico.io/)
- **Pinata**: [app.pinata.cloud](https://app.pinata.cloud/)

### 2.3 (Optional) Import Deployer Key

For contract deployment:

```bash
cast wallet import green-goods-deployer --interactive
# Enter your private key and set a password
```

[Detailed Environment Setup →](../developer/installation.md)

---

## Step 3: Start the Full Stack

Green Goods uses PM2 to orchestrate all services.

### 3.1 Start Everything

```bash
bun dev
```

This starts:
- ✅ **Client PWA**: https://localhost:3001 (HTTPS via mkcert)
- ✅ **Admin Dashboard**: http://localhost:3002
- ✅ **Indexer**: http://localhost:8080 (GraphQL playground)

<!-- TODO: Add screenshot of terminal showing all services -->
![Services Running](../.gitbook/assets/services-running.png)
*All services running via PM2*

### 3.2 Verify Services

**Check service status**:
```bash
bun exec pm2 status
```

**View logs**:
```bash
# All services
bun exec pm2 logs

# Specific service
bun exec pm2 logs client
bun exec pm2 logs admin
bun exec pm2 logs indexer
```

### 3.3 Stop Services

```bash
bun dev:stop
```

---

## Step 4: Explore the Stack

### 4.1 Client PWA (https://localhost:3001)

The main gardener-facing Progressive Web App.

**Key Features to Explore**:
- Passkey authentication (works on localhost)
- MDR workflow (Media → Details → Review)
- Offline queue (disconnect WiFi and try submitting)
- Work dashboard

**Tech Stack**:
- React 18 + TypeScript + Vite
- TanStack Query + Zustand
- Tailwind CSS v4 + Radix UI
- Offline-first architecture

[Client Package Docs →](../developer/architecture/client-package.md)

### 4.2 Admin Dashboard (http://localhost:3002)

Operator and admin interface.

**Key Features to Explore**:
- Wallet connection (MetaMask)
- Garden management (create, edit, view)
- Work review interface
- Member management

**Tech Stack**:
- React 18 + TypeScript + Vite
- Urql (GraphQL) + XState + Zustand
- Tailwind CSS v4 + Radix UI

[Admin Package Docs →](../developer/architecture/admin-package.md)

### 4.3 GraphQL Indexer (http://localhost:8080)

Envio indexer exposing Green Goods blockchain data.

**Try a Query**:
1. Visit http://localhost:8080
2. Password: `testing`
3. Run example query:

```graphql
query Gardens {
  Garden {
    id
    name
    location
  }
}
```

**Tech Stack**:
- Envio HyperIndex
- PostgreSQL (via Docker)
- GraphQL API
- ReScript event handlers

[Indexer Package Docs →](../developer/architecture/indexer-package.md)

---

## Step 5: Run Tests

Green Goods has comprehensive test coverage.

### 5.1 Client Tests

```bash
bun --filter client test
```

**Test Types**:
- Component tests (Vitest + Testing Library)
- Hook tests
- Integration tests
- Service layer tests

### 5.2 Admin Tests

```bash
bun --filter admin test
```

### 5.3 Contract Tests

```bash
bun --filter contracts test
```

**Test Types**:
- Unit tests (Foundry)
- Integration tests
- Gas optimization tests
- Upgrade safety tests

### 5.4 Run All Tests

```bash
bun test
```

[Testing Guide →](../developer/testing.md)

---

## Step 6: Deploy to Testnet (Optional)

### 6.1 Compile Contracts

```bash
bun --filter contracts build
```

### 6.2 Deploy to Base Sepolia

**Dry run first** (simulation):
```bash
bun --filter contracts deploy:dryrun
```

**Deploy for real**:
```bash
bun --filter contracts deploy:testnet
```

**What gets deployed**:
- GardenToken (NFT registry)
- ActionRegistry (task definitions)
- Resolvers (work and approval logic)
- Schemas (EAS attestation templates)
- Root "Green Goods Community Garden"

[Deployment Guide →](../developer/contracts-handbook.md)

---

## Common Development Tasks

### Run Specific Package

```bash
# Client only
bun --filter client dev

# Admin only
bun --filter admin dev

# Contracts compile
bun --filter contracts build
```

### Format Code

```bash
bun format
```

Uses Biome (35x faster than Prettier).

### Lint Code

```bash
bun lint
```

Uses 0xlint (30ms on entire codebase) + Biome.

### Build for Production

```bash
# Build all packages
bun build

# Build specific package
bun --filter client build
```

---

## Project Structure

```
green-goods/
├── packages/
│   ├── client/          # PWA (gardener app)
│   ├── admin/           # Dashboard (operator app)
│   ├── indexer/         # Envio GraphQL
│   └── contracts/       # Solidity smart contracts
├── docs/                # Documentation (you are here!)
├── .env                 # Shared environment variables
└── ecosystem.config.js  # PM2 orchestration
```

### Key Files

- `package.json`: Workspace scripts and dependencies
- `biome.json`: Formatting and linting config
- `.gitbook.yaml`: GitBook documentation config
- `ecosystem.config.js`: PM2 service definitions

[Monorepo Structure Guide →](../developer/architecture/monorepo-structure.md)

---

## Next Steps for Developers

### 🎨 Frontend Development

**Build new features**:
- Create UI components with Radix + Tailwind
- Add hooks using TanStack Query
- Implement offline workflows with job queue
- Add internationalization (en/es/pt)

**Example: Add Garden Filter**:
```typescript
// Add to client/src/components/Garden/GardenFilter.tsx
export function GardenFilter() {
  const [location, setLocation] = useState('');
  
  return (
    <input 
      placeholder="Filter by location..."
      value={location}
      onChange={(e) => setLocation(e.target.value)}
    />
  );
}
```

### ⛓️ Smart Contract Development

**Extend contracts**:
- Add new resolver logic
- Create custom action types
- Implement garden templates
- Add governance features

**Example: Custom Action Type**:
```solidity
// contracts/src/actions/CarbonOffsetAction.sol
contract CarbonOffsetAction is IActionType {
    function validate(WorkSubmission memory work) external view returns (bool) {
        // Custom validation logic
    }
}
```

### 📊 Indexer Development

**Add new queries**:
- Define entities in `schema.graphql`
- Add event handlers in `src/EventHandlers.ts`
- Run `bun codegen` to regenerate types

**Example: Track Action Completion Rates**:
```typescript
// indexer/src/EventHandlers.ts
ActionRegistry.ActionRegistered.handler(async ({ event, context }) => {
  const action = {
    id: event.params.actionUID,
    title: event.params.title,
    completionCount: 0, // Track in WorkApproved handler
  };
  context.Action.set(action);
});
```

### 🔗 API Integrations

Build external tools using the GraphQL API:

```typescript
// Example: Impact dashboard
import { createClient } from 'urql';

const client = createClient({
  url: 'https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql',
});

// Real-time subscription to new approvals
client.subscription(`
  subscription {
    WorkApproval(where: {approved: {_eq: true}}) {
      id
      work { title }
    }
  }
`).subscribe(console.log);
```

---

## Troubleshooting

### "bun not found"

Install Bun: https://bun.sh/docs/installation

### "Port already in use"

```bash
# Check what's using the port
lsof -i :3001  # or :3002, :8080

# Kill the process
kill -9 <PID>
```

### "Docker not running"

```bash
# Start Docker Desktop
open -a Docker

# Wait 30 seconds, then:
bun dev
```

### "Foundry commands not found"

Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### "Indexer fails to start"

```bash
# Reset indexer completely
bun --filter indexer reset

# Restart
bun dev
```

---

## Learn More

### Developer Guides

- [Installation & Setup](../developer/installation.md)
- [Architecture Overview](../developer/architecture/monorepo-structure.md)
- [Testing Guide](../developer/testing.md)
- [API Reference](../developer/api-reference.md)
- [Contributing Guide](../developer/contributing.md)

### Package Documentation

- [Client README](../../packages/client/README.md)
- [Admin README](../../packages/admin/README.md)
- [Contracts README](../../packages/contracts/README.md)
- [Indexer README](../../packages/indexer/README.md)

### Design Resources

- 🎨 [Figma Designs](https://www.figma.com/design/aNmqUjGZ5wR4eNaRqfhbQZ/Green-Goods)
- 📋 [Miro Board](https://miro.com/app/board/uXjVKfMOhPY=/)
- 🎥 [Product Demo](https://www.loom.com/share/e09225ec813147a6aacd4dc8816ce8be?sid=985a42f4-574b-499d-9dc8-03051b797f3d)
- 📊 [Project Tracker](https://devspot.app/en/projects/466)

### Community

- 💬 **Dev Chat**: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 🐙 **GitHub**: [greenpill-dev-guild/green-goods](https://github.com/greenpill-dev-guild/green-goods)
- 🐛 **Issues**: [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)
- 💡 **Discussions**: [GitHub Discussions](https://github.com/greenpill-dev-guild/green-goods/discussions)

---

## What's Next?

You're now set up to build on Green Goods! 🎉

**Your developer toolkit**:
- ✅ Full monorepo running locally
- ✅ All services orchestrated via PM2
- ✅ Tests passing
- ✅ Ready to build features or integrations

**Start building**:
- Explore the codebase
- Fix a [good first issue](https://github.com/greenpill-dev-guild/green-goods/labels/good%20first%20issue)
- Build a custom integration
- Propose a new feature

---

<p align="center">
  <strong>Ready to contribute?</strong><br>
  <a href="../developer/contributing.md">Read Contributing Guide →</a>
</p>

