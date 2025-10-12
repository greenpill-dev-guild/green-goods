# Green Goods Contracts

Smart contracts for the Green Goods Protocol - a decentralized platform for environmental and community impact work.

## Quick Start

Get up and running with Green Goods contract deployment in minutes.

### Prerequisites (One-Time Setup)

#### 1. Install Dependencies

```bash
cd packages/contracts
pnpm install
```

> **⚠️ Important: FFI Requirement**
> 
> Green Goods deployment uses Foundry's FFI (Foreign Function Interface) to generate EAS schema strings from the `config/schemas.json` file. This is **required** for deployment to work.
> 
> - **Already Configured**: `ffi = true` is set in `foundry.toml`
> - **What it does**: Calls `script/utils/generateSchemas.js` to convert schema field definitions into EAS-compatible format strings
> - **Security**: FFI allows execution of external scripts. Our usage is safe (controlled, audited script), but be aware when running untrusted deployment scripts
> - **CI/CD**: Ensure your deployment environment has Node.js available and FFI enabled

#### 2. Setup Foundry Keystore

Import your deployment key (one-time setup):

```bash
cast wallet import green-goods-deployer --interactive
# Enter your private key and set a password
```

Verify it was created:

```bash
cast wallet list
# Should show: green-goods-deployer (address: 0x...)
```

#### 3. Configure Environment

**All environment variables are configured in the root `.env` file** (at the monorepo root, not in this package).

The root `.env` file is automatically loaded by:
- Deployment scripts (`script/deploy.js`)
- Foundry commands (via `foundry.toml` referencing root `.env`)
- All package scripts

Create or edit `.env` at the project root:

```bash
# Required - Foundry keystore account name
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer

# Network RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CELO_RPC_URL=https://forno.celo.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Optional - for contract verification
ETHERSCAN_API_KEY=your-api-key-here
```

#### 4. Fund Your Deployer

Ensure your deployer address has sufficient native tokens:

- **Base Sepolia**: Get free ETH from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- **Celo Mainnet**: Purchase CELO and send to your deployer address
- **Arbitrum Mainnet**: Purchase ETH and send to your deployer address

---

### Deployment by Environment

#### Local Development

Perfect for rapid iteration and testing:

```bash
# Terminal 1: Start local blockchain
pnpm dev

# Terminal 2: Deploy contracts
pnpm deploy:local
```

**What gets deployed:**
- All core contracts with deterministic addresses
- All EAS schemas
- Root "Green Goods Community Garden"
- 3 core actions (Planting, Identify Plant, Litter Cleanup)

**Use when:** Building features, running tests, experimenting locally

---

#### Fork Testing

Test against real network state without spending gas:

```bash
# Fork Celo mainnet
pnpm fork:celo

# In another terminal: deploy to fork
pnpm deploy:local

# Run tests on fork
forge test --fork-url http://localhost:8545 -vv
```

**Use when:** Testing upgrades, validating against real state, debugging production issues

---

#### Testnet (Base Sepolia)

Public testnet deployment for integration testing:

```bash
# Dry run first (no transactions, validates everything)
pnpm deploy:dryrun

# Deploy for real
pnpm deploy:testnet
```

**Use when:** Testing integrations, sharing with team, preparing for mainnet

**Note:** Requires testnet ETH (see Prerequisites above)

---

#### Mainnet (Celo, Arbitrum)

Production deployments:

```bash
# Deploy to Celo mainnet
pnpm deploy:celo

# Deploy to Arbitrum mainnet
pnpm deploy:arbitrum
```

**Use when:** Launching to production

**⚠️ Warning:** Requires real funds. Double-check everything first!

---

### Common Commands Reference

```bash
# 🏗️ DEPLOY (creates new addresses)
pnpm deploy:local        # Local development
pnpm deploy:dryrun       # Dry run (Base Sepolia)
pnpm deploy:testnet      # Base Sepolia testnet
pnpm deploy:celo         # Celo mainnet
pnpm deploy:arbitrum     # Arbitrum mainnet

# 🔄 UPGRADE (keeps same addresses)
pnpm upgrade:testnet     # Upgrade Base Sepolia
pnpm upgrade:celo        # Upgrade Celo mainnet
pnpm upgrade:arbitrum    # Upgrade Arbitrum mainnet

# 🧪 TESTING
pnpm test                # Run all tests
pnpm fork:celo           # Fork Celo mainnet
pnpm fork:arbitrum       # Fork Arbitrum mainnet

# 🔧 DEVELOPMENT
pnpm build               # Compile contracts
pnpm lint                # Format and lint
pnpm dev                 # Start local blockchain
```

---

### Advanced Options

#### Update Schemas Only

If you only need to update EAS schemas:

```bash
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

#### Force Fresh Deployment

Force redeploy everything, even if contracts already exist:

```bash
node script/deploy.js core --network baseSepolia --broadcast --force
```

**⚠️ Warning:** This creates new contract addresses. Existing integrations will break.

---

**📖 For detailed documentation, see:**
- Full Deployment Guide: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- Upgrade Guide: [docs/UPGRADES.md](./docs/UPGRADES.md)
- Environment Setup: [docs/ENVIRONMENT_SETUP.md](./docs/ENVIRONMENT_SETUP.md)
- Troubleshooting: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

## Deployment System

The contracts use a unified deployment CLI that handles:

- **Core Contract Deployment**: All protocol contracts with deterministic addresses
- **Garden Deployment**: Individual gardens from JSON configuration
- **Garden Onboarding**: Bulk garden onboarding from CSV with automatic wallet creation
- **Action Deployment**: Batch action deployment from JSON configuration
- **Network Forking**: Local testing against real network state
- **Gas Optimization**: Built-in gas price monitoring and optimization

### Commands

```bash
# Fresh deployment (all environments)
pnpm deploy:local      # Localhost
pnpm deploy:testnet    # Base Sepolia
pnpm deploy:celo       # Celo mainnet
pnpm deploy:arbitrum   # Arbitrum mainnet

# Dry run (simulation only)
pnpm deploy:dryrun

# Advanced deployment options
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
node script/deploy.js core --network baseSepolia --broadcast --force

# UUPS contract upgrades (different from deployment)
pnpm upgrade:testnet
pnpm upgrade:celo
pnpm upgrade:arbitrum
```

### What Gets Deployed?

Every deployment includes:
- ✅ Core contracts (DeploymentRegistry, GardenToken, ActionRegistry, Resolvers)
- ✅ EAS schemas (Assessment, Work, WorkApproval)
- ✅ Root community garden ("Green Goods Community Garden")
- ✅ 3 core actions (Planting, Identify Plant, Litter Cleanup)

This infrastructure is always deployed - no flags needed.

### Supported Networks

- **localhost** (31337) - Local development
- **sepolia** (11155111) - Ethereum testnet
- **arbitrum** (42161) - Arbitrum One
- **base** (8453) - Base
- **optimism** (10) - Optimism
- **celo** (42220) - Celo

## Schema Management

The Green Goods protocol uses EAS (Ethereum Attestation Service) schemas for on-chain attestations:

### Current Schemas

- **Work Schema**: Gardeners submit completed regenerative agriculture tasks
- **WorkApproval Schema**: Operators approve or reject submitted work  
- **GardenAssessment Schema**: Biodiversity and ecological assessments of garden spaces

### Karma GAP Integration

Green Goods integrates with the **Karma Grantee Accountability Protocol (GAP)** for standardized impact reporting across **8 networks**:

**Supported Networks:**
- Mainnet: Arbitrum, Celo
- Testnet: Base Sepolia

**Automatic Integration:**
- **Garden Creation** → GAP Project attestation created automatically
- **Operator Addition** → Operator added as GAP project admin automatically  
- **Work Approval** → Impact attestation created automatically with work details

**Key Architecture:**
- `GardenAccount` is the owner and sole authority for GAP interactions
- All schema UIDs and contract addresses centralized in `src/lib/Karma.sol`
- Multi-chain support with automatic chain detection
- Graceful degradation - GAP failures don't revert core operations
- Identity-first security - all resolvers verify roles before any logic

**Documentation:**
- User Guide: [docs/KARMA_GAP.md](../../docs/KARMA_GAP.md)
- Implementation: [docs/KARMA_GAP_IMPLEMENTATION.md](../../docs/KARMA_GAP_IMPLEMENTATION.md)
- Upgrade Guide: [docs/UPGRADES.md](../../docs/UPGRADES.md)
- KarmaLib Source: `src/lib/Karma.sol`
- Interfaces: `src/interfaces/IKarmaGap.sol`

**Testing:**
```bash
# Run all GAP E2E fork tests
pnpm test:gap

# Test specific networks
pnpm test:gap:fork:arbitrum
pnpm test:gap:fork:celo
pnpm test:gap:fork:base
```

### Schema Evolution

The current schema implementations are production-ready and can be extended in future versions if needed. Version fields can be added in future schema upgrades without breaking existing attestations.

### Schema Configuration

Schemas are defined in `config/schemas.json` and deployed automatically with core contracts.

### Update Schemas

```bash
# Update schemas only (skip contracts)
node script/deploy.js core --network baseSepolia --broadcast --update-schemas

# Force fresh deployment (redeploy everything)
node script/deploy.js core --network baseSepolia --broadcast --force
```

See `docs/UPGRADES.md` for detailed schema versioning strategy and `docs/DEPLOYMENT.md` for schema deployment troubleshooting.

## Configuration

### Environment Variables

Import your deployment key to Foundry keystore:

```bash
# One-time setup
cast wallet import green-goods-deployer --interactive
# Follow prompts to enter private key and set password

# Verify
cast wallet list
```

Create a `.env` file:

```bash
# Required - Foundry keystore account name
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer

# Network RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
SEPOLIA_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
BASE_RPC_URL=https://...
OPTIMISM_RPC_URL=https://...
CELO_RPC_URL=https://...

# Optional - for contract verification
ETHERSCAN_API_KEY=your-etherscan-v2-api-key
```

### Garden Configuration

Create a JSON file for garden deployment:

```json
{
  "name": "Community Learning Garden",
  "description": "A vibrant space for community collaboration",
  "location": "San Francisco, CA",
  "bannerImage": "QmVvKqpnfJm8UwRq9SF15V2jgJ86yCBsmMBmpEaoQU92bD",
  "gardeners": [
    "0x1234567890123456789012345678901234567890"
  ],
  "operators": [
    "0x4567890123456789012345678901234567890123"
  ]
}
```

### Actions Configuration

Create a JSON file for action deployment:

```json
{
  "actions": [
    {
      "title": "Community Garden Cleanup",
      "instructions": "bafkreiafya2q3nz5dbl4fvxphtrnmahl6hcjyvhzwcimgwnbh4wsy5kr7i",
      "startTime": "2024-02-01T00:00:00Z",
      "endTime": "2024-08-01T00:00:00Z",
      "capitals": ["LIVING", "SOCIAL", "MATERIAL"],
      "media": [
        "bafkreiemwmci42u7cb23xacktk5nfspo5kfsbmflvh6sixjahjbdk2bsie"
      ]
    }
  ]
}
```

## Upgrading Contracts (UUPS)

**Important:** Upgrading is different from deploying:
- **Deploy**: Creates new contracts with new addresses (use `pnpm deploy:*`)
- **Upgrade**: Updates existing proxy implementations, same addresses (use `pnpm upgrade:*`)

All contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern and include storage gaps for safe upgrades.

### Quick Upgrade

```bash
# Dry run (recommended first)
pnpm upgrade:testnet

# Execute upgrade
pnpm upgrade:testnet --broadcast

# Upgrade all contracts on mainnet
pnpm upgrade:celo
pnpm upgrade:arbitrum
```

### Individual Contract Upgrades

```bash
node script/upgrade.js action-registry --network baseSepolia --broadcast
node script/upgrade.js garden-token --network baseSepolia --broadcast
node script/upgrade.js work-resolver --network baseSepolia --broadcast
node script/upgrade.js assessment-resolver --network baseSepolia --broadcast
```

### Upgrading with Resolver Address Changes

When WorkApprovalResolver or AssessmentResolver contracts are upgraded, a new GardenAccount implementation must be deployed:

```bash
# 1. Deploy new resolvers (if needed)
node script/upgrade.js work-approval-resolver --network arbitrum

# 2. Deploy new GardenAccount implementation
forge script script/Upgrade.s.sol:Upgrade \
  --sig "deployNewGardenAccountImplementation(address,address)" \
  <NEW_WORK_APPROVAL_RESOLVER> \
  <NEW_ASSESSMENT_RESOLVER> \
  --network arbitrum --broadcast

# 3. Gardens opt-in to upgrade
forge script script/Upgrade.s.sol:Upgrade \
  --sig "upgradeGardenProxy(address,address)" \
  <GARDEN_PROXY> <NEW_IMPL> \
  --network arbitrum --broadcast
```

See `docs/UPGRADES.md` for complete upgrade guide.

### When to Deploy vs Upgrade

**Use Deploy when:**
- Setting up a new network
- Testing locally or on fork
- Want new contract addresses

**Use Upgrade when:**
- Fixing bugs in production contracts
- Adding features to existing contracts
- Maintaining same addresses for integrations

### Documentation

See [UPGRADES.md](docs/UPGRADES.md) for complete upgrade guide including:
- Deploy vs Upgrade decision matrix
- Storage gap usage
- Multisig upgrade process
- Safety checklist
- Troubleshooting
- Rollback procedures

## Development

### Development Setup

**Prerequisites:**
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Node.js (v16 or higher) and pnpm
- Git

**Development Tools:**
- **Foundry**: Smart contract development framework
- **Solidity**: Smart contract language
- **Forge**: Testing and building
- **Anvil**: Local blockchain for testing

**Code Quality Tools:**
- **Forge**: Built-in Solidity formatter
- **Solhint**: Solidity linting with security rules
- **Biome**: JavaScript/TypeScript formatting for scripts
- **Husky**: Automated git hooks for quality checks

### Development Workflow

**Basic Commands:**
```bash
# Install dependencies
pnpm install

# Build contracts with IR optimization
pnpm build

# Run comprehensive test suite
pnpm test

# Format Solidity code
pnpm format

# Lint contracts for security and style
pnpm lint

# Start local blockchain
pnpm chain
```

**Contract Development:**
```bash
# Compile contracts
pnpm compile

# Run tests with gas reporting
pnpm test

# Run specific test contract
forge test --match-contract YourTestContract -vv

# Run specific test function
forge test --match-test testYourFunction -vvv

# Watch mode for continuous testing
forge test --watch
```

**Local Development:**
```bash
# Start Anvil local blockchain
pnpm chain

# Deploy contracts to local network
pnpm deploy:local

# Check deployment status
pnpm deployment:status localhost
```

**Network Deployment:**
```bash
# Deploy to testnet
pnpm deploy:testnet

# Deploy to mainnet
pnpm deploy:celo
pnpm deploy:arbitrum

# Deploy with update schemas only
node script/deploy.js core --network celo --broadcast --update-schemas

# Force fresh deployment
node script/deploy.js core --network celo --broadcast --force
```

### Configuration Management

**Environment Variables:**

**All environment variables are configured in the root `.env` file** (at the monorepo root).

First, import your key to Foundry keystore (one-time):
```bash
cast wallet import green-goods-deployer --interactive
```

Then create or edit `.env` at the project root (not in `packages/contracts/`):
```bash
# Required for deployment
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer

# Network RPC URLs (choose reliable providers)
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
ARBITRUM_RPC_URL=https://arbitrum-one.publicnode.com
CELO_RPC_URL=https://forno.celo.org
BASE_RPC_URL=https://mainnet.base.org

# Optional - for contract verification
ETHERSCAN_API_KEY=your-etherscan-v2-api-key

# Optional - Enhanced error recovery
SCHEMA_DEPLOYMENT_MAX_RETRIES=3
SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE=false
```

The root `.env` file is automatically loaded by deployment scripts and Foundry commands.

**Network Configuration:**
Networks are configured in `deployments/networks.json`. The system automatically validates:
- RPC connectivity
- Chain ID matching
- Contract address requirements
- Environment variable references

### Testing Strategy

**Test Categories:**
1. **Unit Tests**: Individual contract functionality
2. **Integration Tests**: Cross-contract interactions
3. **Deployment Tests**: Deployment flow validation
4. **Gas Tests**: Gas usage optimization

**Advanced Testing:**
```bash
# Fork testing against live networks
pnpm fork:celo
forge test --fork-url http://localhost:8545

# Gas profiling
forge test --gas-report

# Coverage analysis
forge coverage

# Invariant testing
forge test --match-contract InvariantTest
```

**Test Best Practices:**
- Use descriptive test names
- Test both success and failure cases
- Include edge cases and boundary conditions
- Verify events are emitted correctly
- Test access control and permissions

### Code Quality & Security

**Formatting & Linting:**
```bash
# Format Solidity files
forge fmt

# Lint with security rules
solhint 'src/**/*.sol' 'script/**/*.sol' 'test/**/*.sol'

# Combined format and lint
pnpm lint
```

**Security Considerations:**
- Follow [Solidity best practices](https://consensys.github.io/smart-contract-best-practices/)
- Use OpenZeppelin contracts for standard functionality
- Implement proper access controls
- Consider reentrancy protection
- Validate all external inputs

**Configuration Files:**
- **`foundry.toml`**: Foundry configuration
- **`.solhint.json`**: Solidity linting rules
- **`biome.json`**: JavaScript/TypeScript formatting (for scripts)

### Deployment System

**Deployment CLI Features:**
- **Multi-network Support**: Deploy to any EVM-compatible network
- **Deployment Profiles**: Predefined configurations for different scenarios
- **Error Recovery**: Automatic retry logic with exponential backoff
- **Verification**: Automatic contract verification on block explorers
- **Integration**: Automatic indexer configuration updates

**CLI Usage:**
```bash
# Show available profiles
pnpm deploy:list-profiles

# Dry run deployment (validation only)
pnpm deploy:dryrun --network celo

# Deploy with verbose logging
pnpm deploy:celo --verbose

# Deploy with custom gas strategy
pnpm deploy:celo --gas-strategy aggressive
```

**Adding New Networks:**
1. Update `deployments/networks.json` with network configuration
2. Add RPC URL environment variable
3. Add deployment script to `package.json`
4. Verify configuration with `pnpm network:verify`

### Indexer Integration

**Automatic Integration:**
The contracts package automatically integrates with the indexer:
```bash
# Enable local development integration
pnpm envio:enable-local

# Update indexer after deployment
node script/utils/envio-integration.js update

# Cleanup after development
pnpm envio:cleanup
```

**Manual Integration:**
- Contract addresses are automatically updated in indexer config
- ABIs are synced between packages
- Network configurations are kept consistent

### Gas Optimization

**Gas Monitoring:**
```bash
# Check current gas prices
pnpm gas:check

# Monitor gas prices in real-time
pnpm gas:monitor

# Deploy with gas optimization
pnpm deploy:celo --gas-optimize
```

**Optimization Techniques:**
- Use `--via-ir` flag for Intermediate Representation optimization
- Pack struct variables efficiently
- Use events instead of storage for non-critical data
- Consider CREATE2 for deterministic addresses
- Batch operations when possible

### Troubleshooting

**Common Issues:**

**Compilation Errors:**
```bash
# Clean and rebuild
forge clean
pnpm build

# Check Solidity version compatibility
cat foundry.toml | grep solc

# Update Foundry
foundryup
```

**Deployment Failures:**
```bash
# Verify network configuration
pnpm network:verify

# Check RPC connectivity
curl -X POST $CELO_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Check account balance
cast balance $DEPLOYER_ADDRESS --rpc-url $CELO_RPC_URL
```

**Test Failures:**
```bash
# Run with maximum verbosity
forge test -vvvv

# Debug specific test
forge test --match-test testYourFunction --debug

# Check coverage
forge coverage --report lcov
```

**Gas Issues:**
```bash
# Estimate gas for deployment
forge create src/YourContract.sol:YourContract --estimate

# Profile gas usage
forge test --gas-report

# Check gas limit
cast block latest --field gasLimit --rpc-url $CELO_RPC_URL
```

**Environment Issues:**
```bash
# Verify keystore exists
cast wallet list

# Check keystore address
cast wallet address green-goods-deployer

# Verify RPC URLs
echo $FOUNDRY_KEYSTORE_ACCOUNT
echo $CELO_RPC_URL
```

### Performance Optimization

**Build Performance:**
- Use `--via-ir` for optimized bytecode
- Enable optimizer in `foundry.toml`
- Consider compilation caching

**Test Performance:**
- Use `--match-path` to run specific test files
- Parallelize tests when possible
- Use fork testing judiciously (can be slow)

**Deployment Performance:**
- Monitor gas prices for optimal timing
- Use appropriate gas limits
- Consider batch deployments for multiple contracts

---

## Documentation

**Core Guides:**
- 📘 [Deployment Guide](../../docs/DEPLOYMENT.md) - Complete deployment workflows
- 🔄 [Upgrade Guide](../../docs/UPGRADES.md) - Contract upgrade procedures
- 📊 [Schema Migration Guide](../../docs/SCHEMA_MIGRATION.md) - EAS schema evolution strategies

**Configuration:**
- 📝 [Schema Definitions](./config/schemas.json) - EAS schema configuration
- 🌐 [Network Configuration](./deployments/networks.json) - Multi-chain settings
- 🏗️ [Action Definitions](./config/actions.json) - Core garden actions

**Additional:**
- 📐 [Architecture Overview](../../docs/ARCHITECTURE.md)
- ✅ [Testing Guide](../../docs/TESTING.md)
- 🚀 [Production Readiness](../../docs/PRODUCTION_READINESS.md) 