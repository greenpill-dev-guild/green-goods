# Green Goods Deployment Guide

This comprehensive guide covers deploying Green Goods smart contracts to any EVM-compatible blockchain, including local development, testnets, and mainnet deployments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Network Configuration](#network-configuration)
4. [Core Contract Deployment](#core-contract-deployment)
5. [Garden & Actions Deployment](#garden--actions-deployment)
6. [Fork Testing](#fork-testing)
7. [Gas Optimization](#gas-optimization)
8. [Adding New Networks](#adding-new-networks)
9. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Setup
```bash
cd packages/contracts
cp .env.example .env
# Edit .env with your configuration
pnpm install
```

### 2. Deploy Core Contracts
```bash
# Local development
pnpm deploy:local

# Testnet (Sepolia)
pnpm deploy:testnet

# Mainnet (Arbitrum)
pnpm deploy:arbitrum --broadcast --verify
```

### 3. Deploy Garden & Actions
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

### Environment Variables

Configure your `.env` file:
```bash
# Required
DEPLOYER_PRIVATE_KEY=0x...

# Network RPC URLs
SEPOLIA_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
BASE_RPC_URL=https://...
OPTIMISM_RPC_URL=https://...
CELO_RPC_URL=https://...

# Optional - for contract verification
ETHERSCAN_API_KEY=your-etherscan-v2-api-key
```

## Core Contract Deployment

The main deployment script (`Deploy.s.sol`) deploys all core contracts in the correct order:

1. **DeploymentRegistry** - Central registry for network-specific addresses
2. **AccountGuardian** - Security module for token-bound accounts
3. **GardenAccount** - Implementation for garden accounts
4. **AccountProxy** - Proxy for upgradeable accounts
5. **GardenToken** - NFT contract for gardens
6. **ActionRegistry** - Registry for garden actions
7. **WorkResolver** - Resolver for work attestations
8. **WorkApprovalResolver** - Resolver for work approval attestations

### Deployment Commands

```bash
# Deploy to specific networks
pnpm deploy:local      # Local development
pnpm deploy:testnet    # Sepolia testnet
pnpm deploy:arbitrum   # Arbitrum One
pnpm deploy:base       # Base
pnpm deploy:optimism   # Optimism
pnpm deploy:celo       # Celo

# With verification
pnpm deploy:arbitrum --verify

# Custom deployment
node script/deploy.js --network <network> --broadcast --verify
```

### Deployment Options

- `--network <network>` - Target network (default: localhost)
- `--broadcast` - Execute transactions (required for actual deployment)
- `--verify` - Verify contracts on block explorer
- `--gas-optimize` - Enable gas optimization
- `--save-report` - Generate deployment report

## Garden & Actions Deployment

After core contracts are deployed, you can deploy gardens and actions using JSON configuration files.

### Garden Deployment

Create a garden configuration file:
```json
{
  "name": "Community Learning Garden",
  "description": "A vibrant space for community collaboration",
  "location": "San Francisco, CA",
  "bannerImage": "QmVvKqpnfJm8UwRq9SF15V2jgJ86yCBsmMBmpEaoQU92bD",
  "gardeners": [
    "0x1234567890123456789012345678901234567890",
    "0x2345678901234567890123456789012345678901"
  ],
  "operators": [
    "0x4567890123456789012345678901234567890123"
  ]
}
```

Deploy the garden:
```bash
pnpm deploy:garden config/my-garden.json --network sepolia --broadcast
```

### Garden Onboarding (CSV-based)

For bulk onboarding with automatic wallet creation, use CSV format:

```csv
Instructions: Fill in the garden information and participant details below
Name,Community Learning Garden
Description,A vibrant space where community members collaborate on environmental projects
Location,"San Francisco, CA"
Banner Image,https://example.com/banner.jpg
,
Garden Operators,Gardeners
operator1@example.com,gardener1@example.com
operator2@example.com,gardener2@example.com
,gardener3@example.com
```

**Required Environment Variables for Onboarding:**
```bash
PRIVY_CLIENT_ID=your-privy-client-id
PRIVY_APP_SECRET_ID=your-privy-app-secret
PRIVY_AUTHORIZATION_PRIVATE_KEY=your-privy-auth-key
PINATA_JWT=your-pinata-jwt-token
```

Deploy with onboarding:
```bash
# Test configuration first
pnpm deploy:onboard config/garden-onboarding.csv --network sepolia --dry-run

# Deploy with wallet creation
pnpm deploy:onboard config/garden-onboarding.csv --network sepolia --broadcast
```

**Onboarding Features:**
- **Automatic Wallet Creation**: Creates embedded wallets for email/phone identifiers
- **IPFS Integration**: Automatically uploads banner images to IPFS
- **Bulk Processing**: Handle multiple gardeners and operators at once
- **Validation**: Comprehensive CSV format validation

### Actions Deployment

Create an actions configuration file:
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

Deploy actions:
```bash
pnpm deploy:actions config/my-actions.json --network sepolia --broadcast
```

### Valid Capital Types
`SOCIAL`, `MATERIAL`, `FINANCIAL`, `LIVING`, `INTELLECTUAL`, `EXPERIENTIAL`, `SPIRITUAL`, `CULTURAL`

## Fork Testing

Test deployments against real network state without spending gas:

```bash
# Start network forks
pnpm fork:arbitrum    # Fork Arbitrum One
pnpm fork:base        # Fork Base
pnpm fork:sepolia     # Fork Sepolia

# Deploy to fork
pnpm deploy:fork

# Custom fork with specific block
node script/fork-helpers/setup-fork.js arbitrum 150000000
```

## Gas Optimization

### Monitor Gas Prices
```bash
# Check current gas prices
pnpm gas:check arbitrum

# Monitor gas prices over time
pnpm gas:monitor arbitrum --duration=600
```

### Optimized Deployment
```bash
# Deploy with gas optimization
pnpm deploy:optimized arbitrum --broadcast --verify --gas-strategy=aggressive
```

### Gas Strategies
- **Conservative**: 20% premium for faster inclusion
- **Standard**: 10% premium, balanced approach
- **Aggressive**: Minimize costs, may wait longer

## Adding New Networks

### 1. Update Network Configuration

Edit `deployments/networks.json`:
```json
{
  "networks": {
    "mynetwork": {
      "chainId": 12345,
      "name": "My Network",
      "rpcUrl": "${MY_NETWORK_RPC_URL}",
      "nativeCurrency": {
        "name": "My Token",
        "symbol": "MTK",
        "decimals": 18
      },
      "blockExplorer": "https://explorer.mynetwork.com",
      "verifyApiUrl": "https://api.etherscan.io/v2/api",
      "verifyApiKey": "${ETHERSCAN_API_KEY}",
      "contracts": {
        "eas": "0x...",
        "easSchemaRegistry": "0x...",
        "communityToken": "0x...",
        "erc4337EntryPoint": "0x...",
        "multicallForwarder": "0x..."
      }
    }
  }
}
```

### 2. Add Environment Variables
```bash
MY_NETWORK_RPC_URL=https://rpc.mynetwork.com
```

### 3. Update Package Scripts
```json
{
  "scripts": {
    "deploy:mynetwork": "node script/deploy.js --network mynetwork --broadcast --verify"
  }
}
```

## Troubleshooting

### Common Issues

**Environment variable not set**
- Solution: Ensure all required variables in `.env` are configured

**CREATE2 deployment failed**
- Solution: Contract might already be deployed. Check predicted address.

**Verification failed**
- Solution: Check API key, wait and retry, or verify manually

**Fork not working**
- Solution: Check RPC URL, ensure anvil is installed (`foundryup`)

### Debug Mode
```bash
# Maximum verbosity
forge script script/Deploy.s.sol:Deploy --rpc-url <url> -vvvv
```

### Deployment Status
```bash
# Check deployment status
pnpm deployment:status

# Check specific network
pnpm deployment:status sepolia
```

## Security Considerations

1. **Private Keys**: Never commit private keys. Use hardware wallets for mainnet.
2. **Multisig**: Set `MULTISIG_ADDRESS` for production deployments.
3. **Verification**: Always verify contracts after deployment.
4. **Testing**: Thoroughly test on forks and testnets first.

## File Structure

```
packages/contracts/
├── config/
│   ├── garden-example.json
│   ├── actions-example.json
│   ├── test-garden.json
│   └── test-actions.json
├── deployments/
│   ├── networks.json
│   ├── {chainId}-latest.json
│   ├── gardens/
│   └── actions/
├── script/
│   ├── Deploy.s.sol
│   ├── deploy.js
│   ├── helpers/
│   └── utils/
└── src/
    ├── DeploymentRegistry.sol
    └── ...
```

## Benefits of Optimized System

### Before
- ❌ Multiple separate deployment scripts
- ❌ Hardcoded configurations
- ❌ Manual network management
- ❌ No gas optimization
- ❌ Limited validation

### After
- ✅ Unified deployment system
- ✅ JSON configuration files
- ✅ Network-aware deployment
- ✅ Gas optimization built-in
- ✅ Comprehensive validation
- ✅ Deployment record keeping

## Support

For deployment issues:
1. Check this troubleshooting section
2. Review deployment logs in `broadcast/` directory
3. Open an issue with deployment logs and configuration 