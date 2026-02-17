# Green Goods Contracts

Smart contracts for the Green Goods Protocol - a decentralized platform for environmental and community impact work.

## Quick Start

Get up and running with Green Goods contract deployment in minutes.

### Prerequisites (One-Time Setup)

#### 1. Install Dependencies

```bash
cd packages/contracts
bun install
```

> **⚠️ Important: FFI Requirement**
> 
> Green Goods deployment uses Foundry's FFI (Foreign Function Interface) to generate EAS schema strings from the `config/schemas.json` file. This is **required** for deployment to work.
> 
> - **Already Configured**: `ffi = true` is set in `foundry.toml`
> - **What it does**: Calls `script/utils/generate-schemas.ts` to convert schema field definitions into EAS-compatible format strings
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
- Deployment scripts (`script/deploy.ts`)
- Foundry commands (via `foundry.toml` referencing root `.env`)
- All package scripts

Create or edit `.env` at the project root:

```bash
# Required - Foundry keystore account name
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer

# Network RPC URLs
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
CELO_RPC_URL=https://forno.celo.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Optional - for contract verification
ETHERSCAN_API_KEY=your-api-key-here
```

#### 4. Fund Your Deployer

Ensure your deployer address has sufficient native tokens:

- **Sepolia**: Get free ETH from [Sepolia PoW faucet](https://sepolia-faucet.pk910.de/)
- **Celo Mainnet**: Purchase CELO and send to your deployer address
- **Arbitrum Mainnet**: Purchase ETH and send to your deployer address

---

### Deployment by Environment

#### Local Development

Perfect for rapid iteration and testing:

```bash
# Terminal 1: Start local blockchain
bun dev

# Terminal 2: Deploy contracts (uses default deploy script)
bun deploy
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
# Run E2E tests against forked networks
bun run test:e2e:celo       # Fork and test Celo mainnet
bun run test:e2e:arbitrum   # Fork and test Arbitrum mainnet

# Or manually fork with Anvil
anvil --fork-url $CELO_RPC_URL

# Then run tests on fork
bun run test:e2e:celo    # or bun run test:e2e:arbitrum / :sepolia
```

**Use when:** Testing upgrades, validating against real state, debugging production issues

---

#### Testnet (Sepolia)

Public testnet deployment for integration testing:

```bash
# Dry run first (no transactions, validates everything)
bun deploy:dry:testnet

# Deploy for real
bun deploy:testnet
```

**Use when:** Testing integrations, sharing with team, preparing for mainnet

**Note:** Requires testnet ETH (see Prerequisites above)

---

#### Mainnet (Celo, Arbitrum)

Production deployments:

```bash
# Deploy to Celo mainnet
bun deploy:celo

# Deploy to Arbitrum mainnet
bun deploy:arbitrum
```

**Use when:** Launching to production

**⚠️ Warning:** Requires real funds. Double-check everything first!

---

### Common Commands Reference

```bash
# 🏗️ DEPLOY (creates new addresses)
bun deploy              # Deploy (default settings)
bun deploy:dry:testnet  # Dry run (Sepolia)
bun deploy:testnet      # Sepolia testnet
bun deploy:celo         # Celo mainnet
bun deploy:arbitrum     # Arbitrum mainnet

# 🔄 UPGRADE (keeps same addresses)
bun upgrade:testnet     # Upgrade Sepolia
bun upgrade:celo        # Upgrade Celo mainnet
bun upgrade:arbitrum    # Upgrade Arbitrum mainnet

# 🧪 TESTING
bun run test                # Run all tests
bun run test:e2e:celo       # Fork and test Celo mainnet
bun run test:e2e:arbitrum   # Fork and test Arbitrum mainnet

# 🔧 DEVELOPMENT
bun build               # Compile contracts
bun lint                # Format and lint
bun dev                 # Start local blockchain
```

---

### Advanced Options

#### Update Schemas Only

If you only need to update EAS schemas:

```bash
bun script/deploy.ts core --network sepolia --broadcast --update-schemas
```

#### Force Fresh Deployment

Force redeploy everything, even if contracts already exist:

```bash
bun script/deploy.ts core --network sepolia --broadcast --force
```

**⚠️ Warning:** This creates new contract addresses. Existing integrations will break.

---

**📖 For detailed documentation, see:**
- Full Deployment Guide: [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook)
- Upgrade Guide: [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook)
- Environment Setup: [Developer Quickstart](https://docs.greengoods.app/welcome/quickstart-developer)
- Troubleshooting: [Developer Quickstart](https://docs.greengoods.app/welcome/quickstart-developer)

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
bun deploy            # Default (localhost or configured network)
bun deploy:testnet    # Sepolia
bun deploy:celo       # Celo mainnet
bun deploy:arbitrum   # Arbitrum mainnet

# Dry run (simulation only)
bun deploy:dry:testnet

# Advanced deployment options
bun script/deploy.ts core --network sepolia --broadcast --update-schemas
bun script/deploy.ts core --network sepolia --broadcast --force

# UUPS contract upgrades (different from deployment)
bun upgrade:testnet
bun upgrade:celo
bun upgrade:arbitrum
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
- Testnet: Sepolia

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
- User Guide: [Karma GAP Integration](https://docs.greengoods.app/developer/karma-gap)
- Implementation: [Karma GAP Integration](https://docs.greengoods.app/developer/karma-gap)
- Upgrade Guide: [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook)
- KarmaLib Source: `src/lib/Karma.sol`
- Interfaces: `src/interfaces/IKarmaGap.sol`

**Testing:**
```bash
# Run E2E tests (includes GAP integration)
bun run test:e2e

# Test specific networks
bun run test:e2e:arbitrum   # Fork Arbitrum
bun run test:e2e:celo       # Fork Celo
bun run test:e2e:testnet    # Fork Sepolia
```

### Schema Evolution

The current schema implementations are production-ready and can be extended in future versions if needed. Version fields can be added in future schema upgrades without breaking existing attestations.

### Schema Configuration

Schemas are defined in `config/schemas.json` and deployed automatically with core contracts.

### Update Schemas

```bash
# Update schemas only (skip contracts)
bun script/deploy.ts core --network sepolia --broadcast --update-schemas

# Force fresh deployment (redeploy everything)
bun script/deploy.ts core --network sepolia --broadcast --force
```

See the [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook) for schema versioning strategy and deployment troubleshooting.

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
SEPOLIA_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
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
- **Deploy**: Creates new contracts with new addresses (use `bun deploy:*`)
- **Upgrade**: Updates existing proxy implementations, same addresses (use `bun upgrade:*`)

All contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern and include storage gaps for safe upgrades.

### Quick Upgrade

```bash
# Dry run (recommended first)
bun upgrade:testnet

# Execute upgrade
bun upgrade:testnet --broadcast

# Upgrade all contracts on mainnet
bun upgrade:celo
bun upgrade:arbitrum
```

### Individual Contract Upgrades

```bash
bun script/upgrade.ts action-registry --network sepolia --broadcast
bun script/upgrade.ts garden-token --network sepolia --broadcast
bun script/upgrade.ts work-resolver --network sepolia --broadcast
bun script/upgrade.ts assessment-resolver --network sepolia --broadcast
```

### Upgrading with Resolver Address Changes

When WorkApprovalResolver or AssessmentResolver contracts are upgraded, a new GardenAccount implementation must be deployed:

```bash
# 1. Deploy new resolvers (if needed)
bun script/upgrade.ts work-approval-resolver --network arbitrum

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

See the [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook) for the complete upgrade guide.

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

See the [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook) for the complete upgrade guide including:
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
- Node.js (v18 or higher) and bun
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
bun install

# Build contracts with IR optimization
bun build

# Run comprehensive test suite
bun run test

# Format Solidity code
bun format

# Lint contracts for security and style
bun lint

# Start local blockchain
bun dev
```

**Contract Development:**
```bash
# Compile contracts
bun compile

# Run tests with gas reporting
bun run test

# Run specific test contract
bun run test:match test/unit/YourTestContract.t.sol

# Run specific test function
bun run test:match test/unit/YourTestContract.t.sol

# Watch mode for continuous testing
bun run test --watch
```

**Local Development:**
```bash
# Start Anvil local blockchain
bun dev

# Deploy contracts to local network
bun deploy

# Check deployment status
bun status
```

**Network Deployment:**
```bash
# Deploy to testnet
bun deploy:testnet

# Deploy to mainnet
bun deploy:celo
bun deploy:arbitrum

# Deploy with update schemas only
bun script/deploy.ts core --network celo --broadcast --update-schemas

# Force fresh deployment
bun script/deploy.ts core --network celo --broadcast --force
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
bun run test:e2e:celo       # Automated fork test
# Or manually: anvil --fork-url $CELO_RPC_URL

# Gas profiling
bun run test:gas

# Coverage analysis
forge coverage

# Invariant testing
bun run test:match test/invariant/InvariantTest.t.sol
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
bun lint
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

**Deployment CLI:**
```bash
# Fresh deployment
bun deploy              # Default (localhost)
bun deploy:testnet      # Sepolia
bun deploy:celo         # Celo mainnet
bun deploy:arbitrum     # Arbitrum mainnet

# Dry run (simulation only)
bun deploy:dry:testnet

# Advanced options via deploy.ts
bun script/deploy.ts core --network sepolia --broadcast --update-schemas
bun script/deploy.ts core --network sepolia --broadcast --force
```

**Adding New Networks:**
1. Update `deployments/networks.json` with network configuration
2. Add RPC URL environment variable to root `.env`
3. Add deployment script to `package.json`

### Indexer Integration

**Automatic Integration:**
The contracts package automatically integrates with the indexer:
```bash
# Enable local development integration
bun envio:local

# Update indexer after deployment
bun script/utils/envio-integration.ts update

# Cleanup after development
bun envio:cleanup
```

**Manual Integration:**
- Contract addresses are automatically updated in indexer config
- ABIs are synced between packages
- Network configurations are kept consistent

### Gas Optimization

**Optimization Techniques:**
- `--via-ir` is enabled by default in `foundry.toml` for Intermediate Representation optimization
- Pack struct variables efficiently
- Use events instead of storage for non-critical data
- Consider CREATE2 for deterministic addresses
- Batch operations when possible
- Use `bun run test:gas` to profile gas usage

### Troubleshooting

**Common Issues:**

**Compilation Errors:**
```bash
# Clean and rebuild
forge clean
bun build

# Check Solidity version compatibility
cat foundry.toml | grep solc

# Update Foundry
foundryup
```

**Deployment Failures:**
```bash
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
bun run test

# Debug specific test
bun run test:match test/unit/YourTestContract.t.sol

# Check coverage
forge coverage --report lcov
```

**Gas Issues:**
```bash
# Estimate gas for deployment
forge create src/YourContract.sol:YourContract --estimate

# Profile gas usage
bun run test:gas

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

📖 **[Contracts Documentation](https://docs.greengoods.app/developer/architecture/contracts-package)** — Complete contracts architecture guide

**Essential Guides:**
- 📘 [Contracts Handbook](https://docs.greengoods.app/developer/contracts-handbook) — Deployment, upgrades, schema management
- 🏗️ [Architecture Overview](https://docs.greengoods.app/developer/architecture) — System design and package relationships
- ✅ [Testing Guide](https://docs.greengoods.app/developer/testing) — Testing strategy and best practices

**Configuration Files:**
- 📝 [Schema Definitions](./config/schemas.json) — EAS schema configuration
- 🌐 [Network Configuration](./deployments/networks.json) — Multi-chain settings
- 🏗️ [Action Definitions](./config/actions.json) — Core garden actions
