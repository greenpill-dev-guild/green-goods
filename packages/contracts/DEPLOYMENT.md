# Green Goods Deployment Guide

This comprehensive guide covers deploying Green Goods smart contracts to any EVM-compatible blockchain, including local development, testnets, and mainnet deployments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Network Configuration](#network-configuration)
4. [Core Contract Deployment](#core-contract-deployment)
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
pnpm install
```

### 2. Verify Network Configuration
```bash
# Verify all network configurations before deployment
pnpm network:verify
```

### 3. Deploy Core Contracts (includes EAS schemas)
```bash
# Local development
pnpm deploy:local

# Testnet (Sepolia)
pnpm deploy:sepolia

# Mainnet (Arbitrum)
pnpm deploy:arbitrum --broadcast --verify

# Celo
pnpm deploy:celo --broadcast --verify
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

### Etherscan V2 API Benefits
- **Single API Key**: Works across all supported chains
- **Unified Endpoint**: All requests go to `https://api.etherscan.io/v2/api`
- **Simplified Configuration**: No need for separate API keys per network

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
# Required
PRIVATE_KEY=0x...

# Network RPC URLs
SEPOLIA_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
BASE_RPC_URL=https://...
OPTIMISM_RPC_URL=https://...
CELO_RPC_URL=https://...

# Optional - for contract verification
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
9. **EAS Schemas** - Deployed automatically with retry logic

### Enhanced Error Recovery

The deployment system includes comprehensive error recovery:

- **Configurable Retries**: Customize max attempts via `SCHEMA_DEPLOYMENT_MAX_RETRIES`
- **Exponential Backoff**: Automatic delay between retry attempts
- **Graceful Failure Handling**: Continue deployment with `SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE=true`
- **Detailed Error Logging**: Comprehensive error messages with troubleshooting hints

### Deployment Commands

```bash
# Deploy to specific networks
pnpm deploy:local      # Local development
pnpm deploy:sepolia    # Sepolia testnet
pnpm deploy:arbitrum   # Arbitrum One
pnpm deploy:base       # Base
pnpm deploy:optimism   # Optimism
pnpm deploy:celo       # Celo

# With verification
pnpm deploy:arbitrum --verify

# Custom deployment with error recovery
SCHEMA_DEPLOYMENT_MAX_RETRIES=5 pnpm deploy:celo --broadcast

# Continue deployment despite schema failures
SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE=true pnpm deploy:celo --broadcast
```

### Deployment Options

- `--network <network>` - Target network (default: localhost)
- `--broadcast` - Execute transactions (required for actual deployment)
- `--verify` - Verify contracts on block explorer
- `--gas-optimize` - Enable gas optimization
- `--save-report` - Generate deployment report

## EAS Schema Deployment

EAS schemas are deployed automatically as part of the main deployment process with enhanced error recovery. The schemas are defined in `config/schemas.json` and deployed via Solidity contracts.

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

Test against real network state:
```bash
# Fork and test against Arbitrum
pnpm fork:arbitrum

# Fork and test against Celo
pnpm fork:celo

# Run tests on fork
pnpm test
```

## Testing & Validation

### Comprehensive Test Suite

Run the deployment test suite to validate functionality:

```bash
# Run all deployment tests
forge test --match-contract DeploymentTest -vv

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