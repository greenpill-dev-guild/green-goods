# Green Goods Deployment Guide

This comprehensive guide covers deploying Green Goods smart contracts to any EVM-compatible blockchain, including local development, testnets, and mainnet deployments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Network Configuration](#network-configuration)
4. [Core Contract Deployment](#core-contract-deployment)
   - 4.1. [Always-Deployed Infrastructure](#always-deployed-infrastructure)
   - 4.2. [Deploy vs Upgrade Workflows](#deploy-vs-upgrade-workflows)
5. [EAS Schema Deployment](#eas-schema-deployment)
6. [Garden & Actions Deployment](#garden--actions-deployment)
7. [Fork Testing](#fork-testing)
8. [Testing & Validation](#testing--validation)
9. [Gas Optimization](#gas-optimization)
10. [Adding New Networks](#adding-new-networks)
11. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Setup
```bash
cd packages/contracts
cp .env.example .env
# Edit .env with your configuration
bun install
```

### 2. Verify Network Configuration
```bash
# Verify all network configurations before deployment
pnpm network:verify
```

### 3. Deploy Core Contracts (includes EAS schemas)
```bash
# Local development (includes root garden + core actions)
pnpm deploy:local

# Testnet deployment
pnpm deploy:testnet

# Mainnet deployments
pnpm deploy:celo
pnpm deploy:arbitrum

# Dry run (simulation only, no transactions)
pnpm deploy:dryrun

# Advanced: Update schemas only
node script/deploy.js core --network baseSepolia --broadcast --update-schemas

# Advanced: Force fresh deployment
node script/deploy.js core --network baseSepolia --broadcast --force
```

### 4. Deploy Garden & Actions
```bash
# Deploy a garden from JSON
pnpm deploy:garden config/garden-example.json --network sepolia --broadcast

# Onboard gardens from CSV with wallet creation
pnpm deploy:onboard config/garden-onboarding-example.csv --network sepolia --broadcast

# Deploy actions
pnpm deploy:actions config/actions-example.json --network sepolia --broadcast
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Node.js v16+ and pnpm
- Git
- RPC endpoints for target networks
- Etherscan V2 API key (optional, for verification)
- **Foundry Keystore** (required for all deployments - see setup below)

### Etherscan V2 API Benefits
- **Single API Key**: Works across all supported chains
- **Unified Endpoint**: All requests go to `https://api.etherscan.io/v2/api`
- **Simplified Configuration**: No need for separate API keys per network

## Foundry Keystore Setup (Required)

All deployments now use Foundry's secure keystore instead of plaintext private keys. This provides enhanced security with password-protected encrypted keys.

### Initial Setup

#### 1. Import Your Deployment Key

```bash
# Import your private key to Foundry keystore (one-time setup)
cast wallet import green-goods-deployer --interactive

# You'll be prompted to:
# 1. Enter your private key (with or without 0x prefix)
# 2. Set a strong password for encryption
# 
# Example output:
# Enter private key:
# Enter password:
# `green-goods-deployer` keystore was saved successfully.
```

#### 2. Verify Keystore Creation

```bash
# List all keystores
cast wallet list

# Expected output:
# green-goods-deployer (address: 0x...)

# View deployer address (requires password)
cast wallet address green-goods-deployer

# Enter password when prompted
# Expected output: 0x... (your deployer address)
```

#### 3. Fund Deployer Address

Ensure your deployer address has sufficient native tokens for gas:

**Testnets:**
- **Base Sepolia**: [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- **Sepolia**: [Sepolia Faucet](https://sepoliafaucet.com/)
- **Celo Alfajores**: [Celo Faucet](https://faucet.celo.org/)

**Mainnets:**
- Purchase native tokens (ETH, CELO, etc.) and send to your deployer address
- Recommended: Keep 0.1-0.5 ETH for multiple deployments

#### 4. Configure Environment

Create or update `.env` file:

```bash
# Required
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Optional but recommended
SENDER_ADDRESS=0x...  # Your deployer address
ETHERSCAN_API_KEY=... # For contract verification
```

### Security Benefits

✅ **Encrypted Storage**: Private key encrypted with password at rest  
✅ **No Plaintext Keys**: No private keys in environment variables or .env files  
✅ **Interactive Prompts**: Password required for each deployment session  
✅ **Git-Safe**: Impossible to accidentally commit private keys  
✅ **Command History Safe**: No keys exposed in terminal history  
✅ **Backup-Friendly**: Keystore file can be securely backed up  
✅ **Hardware Wallet Ready**: Foundation for future hardware wallet integration

### Managing Multiple Deployers

```bash
# Import additional keystores for different environments
cast wallet import green-goods-testnet --interactive
cast wallet import green-goods-mainnet --interactive

# Switch deployer by changing environment variable
export FOUNDRY_KEYSTORE_ACCOUNT=green-goods-testnet
pnpm deploy:base-sepolia:optimized
```

## Network Configuration

The deployment system supports multiple networks configured in `deployments/networks.json`:

- **localhost** (31337) - Local development
- **sepolia** (11155111) - Ethereum testnet
- **arbitrum** (42161) - Arbitrum One
- **base** (8453) - Base
- **optimism** (10) - Optimism
- **celo** (42220) - Celo

### Network Verification

Before deployment, verify your network configuration:

```bash
# Verify all network configurations
pnpm network:verify
```

This utility will:
- ✅ Check required configuration fields
- 🔗 Test RPC connectivity
- 🆔 Verify chain IDs match
- ⚠️ Identify environment variable usage
- 📋 Validate EAS contract addresses

### Environment Variables

Configure your `.env` file:
```bash
# Required - Foundry Keystore (see Foundry Keystore Setup section)
FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer

# Network RPC URLs
SEPOLIA_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
BASE_RPC_URL=https://...
OPTIMISM_RPC_URL=https://...
CELO_RPC_URL=https://...

# Optional but recommended - for contract verification
ETHERSCAN_API_KEY=your-etherscan-v2-api-key

# Optional - Enhanced error recovery
SCHEMA_DEPLOYMENT_MAX_RETRIES=3
SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE=false
```

## Core Contract Deployment

The main deployment script (`Deploy.s.sol`) deploys all core contracts and EAS schemas in the correct order with enhanced error recovery:

1. **DeploymentRegistry** - Central registry for network-specific addresses
2. **AccountGuardian** - Security module for token-bound accounts
3. **GardenAccount** - Implementation for garden accounts
4. **AccountProxy** - Proxy for upgradeable accounts
5. **GardenToken** - NFT contract for gardens
6. **ActionRegistry** - Registry for garden actions
7. **WorkResolver** - Resolver for work attestations
8. **WorkApprovalResolver** - Resolver for work approval attestations
9. **AssessmentResolver** - Resolver for assessment attestations
10. **EAS Schemas** - Deployed automatically with retry logic

### Always-Deployed Infrastructure

Every deployment automatically includes:

#### 1. Core Contracts (9 contracts)
- DeploymentRegistry (proxy)
- AccountGuardian
- GardenAccount (implementation)
- AccountProxy
- GardenToken (proxy)
- ActionRegistry (proxy)
- WorkResolver (proxy)
- WorkApprovalResolver (proxy)
- AssessmentResolver (proxy)

#### 2. EAS Schemas (3 schemas)
- Garden Assessment Schema
- Work Schema
- Work Approval Schema

#### 3. Root Garden (1 garden)
- "Green Goods Community Garden"
- Configured from `config/garden.json`

#### 4. Core Actions (3 actions)
- Planting
- Identify Plant
- Litter Cleanup
- Configured from `config/actions.json`

This ensures every network has a functional baseline for testing and development.

### Enhanced Error Recovery

The deployment system includes comprehensive error recovery:

- **Configurable Retries**: Customize max attempts via `SCHEMA_DEPLOYMENT_MAX_RETRIES`
- **Exponential Backoff**: Automatic delay between retry attempts
- **Graceful Failure Handling**: Continue deployment with `SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE=true`
- **Detailed Error Logging**: Comprehensive error messages with troubleshooting hints

### Deployment Commands

```bash
# Environment-specific deployments
pnpm deploy:local      # Localhost (anvil)
pnpm deploy:dryrun     # Dry run on Base Sepolia
pnpm deploy:testnet    # Base Sepolia with broadcast
pnpm deploy:celo       # Celo mainnet
pnpm deploy:arbitrum   # Arbitrum mainnet

# Advanced deployment modes
# Update schemas only (skip existing contracts)
node script/deploy.js core --network baseSepolia --broadcast --update-schemas

# Force fresh deployment (redeploy everything)
node script/deploy.js core --network baseSepolia --broadcast --force
```

### Deployment Flags

- `--network <network>` - Target network (default: localhost)
- `--broadcast` - Execute transactions (required for actual deployment)
- `--update-schemas` - Only update EAS schemas, skip existing contracts
- `--force` - Force fresh deployment even if contracts exist

**Note:** Contract verification happens automatically on supported networks (no flag needed).

### Simulation vs Broadcast

**Critical Difference:**

| Mode | Command | Transactions | Deployment File | Use Case |
|------|---------|--------------|-----------------|----------|
| **Simulation** | `pnpm deploy:dryrun` | ❌ Not sent | ❌ Not updated | Testing, validation |
| **Broadcast** | `pnpm deploy:testnet` | ✅ Sent to chain | ✅ Updated | Actual deployment |

**Simulation Mode (Default without `--broadcast`):**
```bash
# Dry run - no transactions, no file updates
node script/deploy.js core --network baseSepolia
```

- ✅ Tests deployment logic
- ✅ Validates configuration
- ✅ Estimates gas costs
- ❌ **Does NOT update `deployments/{chainId}-latest.json`**
- ❌ Does NOT send transactions
- ⚡ Use for: Testing before production deployment

**Broadcast Mode (With `--broadcast`):**
```bash
# Real deployment - transactions sent, file updated
node script/deploy.js core --network baseSepolia --broadcast
```

- ✅ Sends real transactions
- ✅ **Updates `deployments/{chainId}-latest.json`**
- ✅ Deploys to actual blockchain
- ✅ Costs real gas/ETH
- ⚡ Use for: Production deployments

**Why This Matters:**
- Prevents accidental file updates during testing
- Keeps deployment files synchronized with actual on-chain state
- CI/CD pipelines can run simulations without side effects
- Team members can test locally without modifying shared deployment files

### Deploy vs Upgrade Workflows

Understanding the difference between deploying and upgrading contracts is crucial:

#### Fresh Deployment (deploy.js)
Creates new contract instances with new addresses.

**Use cases:**
- Setting up a new network
- Local development and testing
- Fork testing against mainnet state
- Initial testnet/mainnet deployment

**Command:**
```bash
pnpm deploy:testnet
```

**What happens:**
1. Deploys all contract implementations
2. Deploys all proxy contracts
3. Deploys EAS schemas
4. Creates root garden
5. Registers 3 core actions
6. Saves addresses to `deployments/{chainId}-latest.json`

#### UUPS Proxy Upgrade (upgrade.js)
Updates existing proxy implementations, keeping same addresses.

**Use cases:**
- Fixing bugs in production
- Adding new features
- Security patches
- Gas optimizations

**Command:**
```bash
pnpm upgrade:testnet
```

**What happens:**
1. Deploys new implementation contracts
2. Calls `upgradeToAndCall()` on existing proxies
3. Existing addresses remain unchanged
4. Storage layout preserved
5. No schema redeployment

#### Decision Matrix

| Scenario | Use Deploy | Use Upgrade |
|----------|-----------|-------------|
| New network setup | ✅ | ❌ |
| Local development | ✅ | ❌ |
| Fork testing | ✅ | ❌ |
| Bug fix in production | ❌ | ✅ |
| Add contract features | ❌ | ✅ |
| Change schema definitions | ✅* | ❌ |
| Want new addresses | ✅ | ❌ |
| Keep existing addresses | ❌ | ✅ |

*Use `--update-schemas` flag for schema-only updates

#### Example Workflows

**Local Development:**
```bash
# Start local chain
pnpm dev

# Deploy everything (new terminal)
pnpm deploy:local

# Make contract changes, then upgrade
pnpm upgrade:local
```

**Testnet Deployment:**
```bash
# Initial deployment
pnpm deploy:testnet

# Later: upgrade contracts
pnpm upgrade:testnet

# Later: update schemas
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

**Production Deployment:**
```bash
# Initial mainnet deployment
pnpm deploy:celo

# Later: upgrade via multisig
# 1. Propose upgrade transaction to multisig
# 2. Multisig members sign
# 3. Execute upgrade
pnpm upgrade:celo --broadcast
```

## EAS Schema Deployment

EAS schemas are deployed automatically as part of the main deployment process with enhanced error recovery. The schemas are defined in `config/schemas.json` and deployed via Solidity contracts.

### FFI Requirement

> **⚠️ Critical Requirement: Foundry FFI Must Be Enabled**
> 
> Green Goods schema deployment uses Foundry's **FFI (Foreign Function Interface)** to dynamically generate EAS schema strings from JSON configuration.
> 
> **Configuration:**
> - `ffi = true` in `foundry.toml` ✅ (already configured)
> 
> **How it works:**
> 1. Solidity calls `vm.ffi()` during deployment
> 2. Executes `node script/utils/generateSchemas.js <schemaName>`
> 3. Node script reads `config/schemas.json`
> 4. Generates EAS-compatible schema string (e.g., `"string title,uint256 amount,..."`)
> 5. Returns to Solidity for schema registration
> 
> **Requirements:**
> - Node.js v16+ must be available in deployment environment
> - FFI enabled in Foundry configuration
> - `script/utils/generateSchemas.js` must be executable
> 
> **Security Note:**
> FFI allows execution of external programs. Our usage is safe (controlled, audited script), but be cautious when running untrusted deployment scripts. Review `script/utils/generateSchemas.js` before first deployment.
> 
> **CI/CD Setup:**
> ```yaml
> # Ensure Node.js and FFI are available
> - uses: actions/setup-node@v3
>   with:
>     node-version: '18'
> - name: Enable FFI
>   run: forge config --ffi
> ```

### Schema Configuration

Schemas are configured in `config/schemas.json`:

```json
{
  "schemas": {
    "gardenAssessment": {
      "name": "Garden Assessment",
      "description": "Assess a Green Goods garden space biodiversity.",
      "revocable": true,
      "fields": [
        {"name": "soilMoisturePercentage", "type": "uint8"},
        {"name": "carbonTonStock", "type": "uint256"}
      ]
    },
    "work": {
      "name": "Work Submission",
      "description": "Upload work on a Green Goods space.",
      "revocable": true,
      "fields": [
        {"name": "actionUID", "type": "uint256"},
        {"name": "title", "type": "string"}
      ]
    },
    "workApproval": {
      "name": "Work Approval",
      "description": "Approve work on a Green Goods space.",
      "revocable": true,
      "fields": [
        {"name": "actionUID", "type": "uint256"},
        {"name": "approved", "type": "bool"}
      ]
    }
  }
}
```

### Schema Types

1. **Garden Assessment Schema** - For biodiversity assessments
2. **Work Schema** - For work submissions
3. **Work Approval Schema** - For work approvals

### Schema UIDs

After deployment, the schema UIDs are automatically saved to the deployment file at `deployments/{chainId}-latest.json`:

```json
{
  "schemas": {
    "gardenAssessmentSchemaUID": "0x...",
    "workSchemaUID": "0x...", 
    "workApprovalSchemaUID": "0x..."
  }
}
```

### Schema Migration & Update Strategy

Green Goods supports multiple deployment modes for schemas, allowing you to update schemas without redeploying contracts.

#### Update Schemas Only (Recommended)

When you need to update schema metadata or deploy new schemas alongside existing contracts:

```bash
# Update/deploy schemas while preserving existing contracts
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

**Use cases:**
- ✅ Schema name or description updated
- ✅ New schema fields added (requires new schema)
- ✅ Resolver addresses changed
- ✅ Deploying to network with existing contracts
- ✅ Fixing schema metadata attestations

**What happens:**
1. Loads existing contract addresses from `deployments/{chainId}-latest.json`
2. Skips contract deployment (uses existing addresses)
3. Registers new schemas or updates existing ones
4. Creates/updates metadata attestations (name & description)
5. Preserves all contract addresses

**Important:** EAS schemas are **immutable**. You cannot modify a schema's fields after deployment. To change fields, you must:
1. Deploy a new schema with updated fields
2. Update resolver contracts to recognize new schema UID
3. Support both old and new schemas in your application

#### Force Fresh Deployment

Complete redeployment of all contracts and schemas (creates new addresses):

```bash
# Force redeploy everything - USE WITH CAUTION
node script/deploy.js core --network baseSepolia --broadcast --force
```

**Use cases:**
- 🆕 First deployment to a new network
- 🧪 Testing with clean state
- ⚠️ Production: Only when required (breaking changes)

**⚠️ Warning:** 
- Creates new contract addresses
- Breaks existing integrations
- Requires updating all dependent systems
- Old attestations remain but reference old contracts

#### Schema Reuse Logic

The deployment system automatically handles schema reuse:

1. **Check existing deployment**: Reads `deployments/{chainId}-latest.json`
2. **Verify on-chain**: Confirms schema exists and resolver matches
3. **Reuse or redeploy**:
   - ✅ Schema exists + resolver matches → Reuse existing
   - ❌ Schema missing or resolver mismatch → Deploy new
4. **Update metadata**: Always creates/updates name & description attestations

**Example: Adding a Field**

```json
// Before: config/schemas.json
{
  "work": {
    "fields": [
      {"name": "actionUID", "type": "uint256"},
      {"name": "title", "type": "string"}
    ]
  }
}

// After: Add new field
{
  "work": {
    "fields": [
      {"name": "actionUID", "type": "uint256"},
      {"name": "title", "type": "string"},
      {"name": "photos", "type": "string[]"}  // NEW
    ]
  }
}
```

**Deployment:**
```bash
# Deploy new schema alongside existing
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

**Result:**
- ✅ New schema UID created with additional field
- ✅ Old schema UID remains valid
- ✅ Existing contracts unchanged
- ⚠️ Must update resolvers to handle both schemas

**See also:** [Schema Migration Guide](./SCHEMA_MIGRATION.md) and [Upgrades Guide](./UPGRADES.md)

### Schema Versioning

All schemas include a `uint8 version` field as the first field:

```json
{
  "fields": [
    {"name": "version", "type": "uint8"},
    {"name": "actionUID", "type": "uint256"},
    // ... other fields
  ]
}
```

**Benefits:**
- Future-proof schema evolution
- Backward compatibility with V1 attestations
- Clear migration path for frontend/indexer
- No breaking changes to existing data

See `docs/UPGRADES.md` for detailed schema versioning strategy.

### Troubleshooting Schema Deployment

**"AlreadyExists()" Error:**
- Schema with same string already registered
- Expected if deploying unchanged schemas
- Use `FORCE_SCHEMA_DEPLOYMENT=true` to redeploy modified schemas
- Clear `deployments/{chainId}-latest.json` schema UIDs to force fresh deployment

**"Schema Registry Address Zero":**
- Network configuration missing EAS schema registry address
- Check `deployments/networks.json` for your target network
- Verify network name matches chain ID in configuration

**Post-Deployment Verification:**

```bash
# Verify schema exists on-chain
cast call <SCHEMA_REGISTRY> "getSchema(bytes32)" <SCHEMA_UID> \
  --rpc-url $BASE_SEPOLIA_RPC_URL

# Expected output: schema string, resolver address, revocable flag

# Verify resolver is a proxy
cast call <RESOLVER_ADDRESS> "owner()(address)" \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

## Garden & Actions Deployment

After core contracts are deployed, you can deploy gardens and actions using JSON configuration files.

### Garden Deployment

Create a garden configuration file:
```json
{
  "name": "Example Garden",
  "description": "A test garden for Green Goods",
  "location": "San Francisco, CA",
  "bannerImage": "QmHash...",
  "gardeners": ["0x..."],
  "operators": ["0x..."]
}
```

Deploy with:
```bash
pnpm deploy:garden config/garden.json --network celo --broadcast
```

### Bulk Garden Onboarding

For bulk onboarding with automatic wallet creation:
```bash
pnpm deploy:onboard config/garden-onboarding-example.csv --network celo --broadcast
```

### Action Deployment

Deploy actions from JSON configuration:
```bash
pnpm deploy:actions config/actions.json --network celo --broadcast
```

## Fork Testing

Test against real network state without spending gas:

```bash
# Test against real Celo state
pnpm fork:celo

# In another terminal: deploy to fork
pnpm deploy:local

# Run tests on fork
forge test --fork-url http://localhost:8545 -vv

# Test upgrades on fork
pnpm upgrade:local
```

**Use cases:**
- Testing upgrades against production state
- Debugging production issues
- Validating against real data
- Integration testing with live contracts

## Testing & Validation

### Comprehensive Test Suite

Run the deployment test suite to validate functionality:

```bash
# Test deployment flow
forge test --match-contract DeploymentTest -vv

# Test upgrade flow
forge test --match-contract UpgradeTest -vv

# Test both on fork
pnpm fork:celo
forge test --fork-url http://localhost:8545 -vv

# Test specific scenarios
forge test --match-test testIdempotentDeployment -vvv
forge test --match-test testSchemaDeploymentFailureRecovery -vvv
forge test --match-test testNetworkFallback -vvv
```

### Test Coverage

The test suite validates:
- ✅ **Core Contract Deployment**: All contracts deploy correctly
- ✅ **Enhanced Error Recovery**: Retry logic and failure handling
- ✅ **Idempotent Deployments**: Safe re-runs without conflicts
- ✅ **Schema Validation**: EAS schema deployment and verification
- ✅ **Network Fallbacks**: Deployment on unsupported networks
- ✅ **Gas Optimization**: Performance tracking
- ✅ **Configuration Handling**: Environment variable processing

### Deployment Validation

```bash
# Check deployment status
pnpm deployment:status

# Verify network configuration
pnpm network:verify

# Validate specific deployment
forge test --match-test testDeploymentFlowLocalhost -vvv
```

## Gas Optimization

The deployment system includes built-in gas optimization:

```bash
# Check current gas prices
pnpm gas:check

# Monitor gas prices in real-time
pnpm gas:monitor

# Deploy with gas optimization
pnpm deploy:celo --gas-optimize --broadcast
```

## Adding New Networks

To add a new network:

1. Update `deployments/networks.json`:
```json
{
  "networks": {
    "newchain": {
      "chainId": 12345,
      "name": "New Chain",
      "rpcUrl": "${NEWCHAIN_RPC_URL}",
      "nativeCurrency": {
        "name": "New Token",
        "symbol": "NEW",
        "decimals": 18
      },
      "blockExplorer": "https://newscan.io",
      "verifyApiUrl": "https://api.etherscan.io/v2/api",
      "verifyApiKey": "${ETHERSCAN_API_KEY}",
      "contracts": {
        "eas": "0x...",
        "easSchemaRegistry": "0x..."
      }
    }
  }
}
```

2. Add RPC URL to `.env`:
```bash
NEWCHAIN_RPC_URL=https://rpc.newchain.com
```

3. Add deployment script to `package.json`:
```bash
"deploy:newchain": "node script/deploy.js core --network newchain --broadcast --verify"
```

4. Verify the configuration:
```bash
pnpm network:verify
```

## Troubleshooting

### Pre-Deployment Validation

```bash
# Verify network configuration before deployment
pnpm network:verify

# Test deployment locally first
pnpm deploy:local

# Run deployment tests
forge test --match-contract DeploymentTest -vv
```

### Keystore Issues

#### "keystore not found"

```bash
# Verify keystore exists
cast wallet list

# If missing, import your key
cast wallet import green-goods-deployer --interactive

# Verify it was created
cast wallet address green-goods-deployer
```

**Root Causes:**
- Keystore was never imported
- Using wrong account name in `FOUNDRY_KEYSTORE_ACCOUNT`
- Keystore file was deleted from `~/.foundry/keystores/`

#### "invalid password"

```bash
# Re-enter password carefully
# Password is case-sensitive and must match exactly

# If password forgotten, re-import with new password:
cast wallet import green-goods-deployer --interactive --force
# This will overwrite the existing keystore
```

#### "insufficient funds for gas"

```bash
# Check deployer balance
cast balance $(cast wallet address green-goods-deployer) --rpc-url $BASE_SEPOLIA_RPC_URL

# For Base Sepolia testnet, get free ETH:
# https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

# Verify you're on the correct network
echo $BASE_SEPOLIA_RPC_URL
```

#### "account not found in keystore"

```bash
# Check FOUNDRY_KEYSTORE_ACCOUNT matches your imported keystore
echo $FOUNDRY_KEYSTORE_ACCOUNT

# Should match output from:
cast wallet list

# Update environment variable if needed
export FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer
```

#### Schema Deployment with Keystore

All schema deployments (registration + attestations) use the same keystore. You'll only be prompted for the password once per deployment session.

**Common Issues:**
- **Schema registration fails**: Check deployer has sufficient gas
- **Attestation creation fails**: Verify EAS contract addresses in `deployments/networks.json`
- **Password timeout**: Re-run deployment if password prompt times out

```bash
# Verify EAS addresses for Base Sepolia
cat deployments/networks.json | grep -A 5 '"baseSepolia"'

# Should show:
# "eas": "0x4200000000000000000000000000000000000021",
# "easSchemaRegistry": "0x4200000000000000000000000000000000000020"
```

### Deploy vs Upgrade Confusion

#### "Contract already deployed"

This usually means you're trying to deploy when you should upgrade:

```bash
# ❌ Wrong: Trying to deploy again
pnpm deploy:testnet

# ✅ Right: Upgrade existing deployment
pnpm upgrade:testnet
```

#### "Cannot find deployment file"

You're trying to upgrade but haven't deployed yet:

```bash
# ❌ Wrong: Trying to upgrade non-existent deployment
pnpm upgrade:testnet

# ✅ Right: Deploy first, then upgrade
pnpm deploy:testnet
# ... later ...
pnpm upgrade:testnet
```

#### "Force fresh deployment"

If you want to completely redeploy (new addresses):

```bash
# This will deploy everything fresh, ignoring existing deployments
node script/deploy.js core --network baseSepolia --broadcast --force
```

**⚠️ Warning:** This creates new contract addresses. Existing integrations will break.

### Common Issues & Solutions

1. **Schema deployment fails**
   ```bash
   # Enable graceful failure handling
   SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE=true pnpm deploy:celo
   
   # Increase retry attempts
   SCHEMA_DEPLOYMENT_MAX_RETRIES=5 pnpm deploy:celo
   ```

2. **Gas estimation fails**
   ```bash
   # Check current gas prices
   pnpm gas:check
   
   # Use gas optimization
   pnpm deploy:celo --gas-optimize
   ```

3. **RPC connectivity issues**
   ```bash
   # Verify network configuration
   pnpm network:verify
   
   # Test specific network
   curl -X POST $CELO_RPC_URL -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
   ```

4. **Verification fails**
   ```bash
   # Manual verification
   forge verify-contract --chain-id 42220 0x... src/Contract.sol:Contract
   
   # Check Etherscan API key
   echo $ETHERSCAN_API_KEY
   ```

### Enhanced Error Recovery Testing

```bash
# Test failure recovery with mock failures
forge test --match-test testSchemaDeploymentFailureRecovery -vvv

# Test with skip-on-failure enabled
SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE=true forge test --match-test testSchemaDeploymentFailureRecovery
```

### Debug Commands

```bash
# Check deployment status across networks
pnpm deployment:status

# Verify specific contract
forge verify-contract --chain-id 42220 0x... src/Contract.sol:Contract

# Monitor gas prices
pnpm gas:monitor

# Test deployment with maximum verbosity
forge test --match-contract DeploymentTest -vvvv
```

### Getting Help

1. **Pre-deployment**: Run `pnpm network:verify` to catch configuration issues
2. **During deployment**: Check logs for specific error messages
3. **Post-deployment**: Run `forge test --match-contract DeploymentTest` to validate
4. **Configuration issues**: Verify `deployments/networks.json` and `.env` setup
5. **Test locally first**: Use `pnpm deploy:local` before mainnet deployment

## Summary

The Green Goods deployment system now provides:

- **🔧 Network Verification Utility**: Pre-deployment configuration validation
- **🔄 Enhanced Error Recovery**: Configurable retry logic with exponential backoff
- **🧪 Comprehensive Test Suite**: Automated validation of deployment functionality
- **📊 Real-time Gas Monitoring**: Built-in gas price tracking and optimization
- **🌐 Multi-Chain Support**: Deploy to any EVM-compatible network
- **🎯 Deterministic Addresses**: Using CREATE2 for predictable contract addresses
- **✅ Automatic Verification**: Contract verification on block explorers
- **⚙️ Flexible Configuration**: Easy network addition and deployment customization
- **🔍 Advanced Troubleshooting**: Comprehensive debugging tools and utilities

The deployment process is now fully integrated with robust error handling, comprehensive testing, and advanced monitoring capabilities, ensuring reliable deployments across all supported networks. 

