# Green Goods Contracts

Smart contracts for the Green Goods Protocol - a decentralized platform for environmental and community impact work.

## Quick Start

```bash
# Install dependencies
pnpm install

# Deploy to local development
pnpm deploy:local

# Deploy to testnet
pnpm deploy:testnet

# Deploy a garden
pnpm deploy:garden config/garden-example.json --network sepolia --broadcast

# Onboard gardens with automatic wallet creation
pnpm deploy:onboard config/garden-onboarding-example.csv --network sepolia --broadcast

# Deploy actions
pnpm deploy:actions config/actions-example.json --network sepolia --broadcast
```

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
# Core contract deployment
node script/deploy.js core --network <network> --broadcast --verify

# Garden deployment
node script/deploy.js garden <config.json> --network <network> --broadcast

# Garden onboarding (CSV with wallet creation)
node script/deploy.js onboard <config.csv> --network <network> --broadcast

# Action deployment
node script/deploy.js actions <config.json> --network <network> --broadcast

# Deployment status
node script/deploy.js status [network]

# Network forking
node script/deploy.js fork <network>
```

### Supported Networks

- **localhost** (31337) - Local development
- **sepolia** (11155111) - Ethereum testnet
- **arbitrum** (42161) - Arbitrum One
- **base** (8453) - Base
- **optimism** (10) - Optimism
- **celo** (42220) - Celo

## Configuration

### Environment Variables

Create a `.env` file:

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

## Development

```bash
# Build contracts
pnpm build

# Run tests
pnpm test

# Format code
pnpm format

# Lint contracts
pnpm lint

# Start local blockchain
pnpm chain
```

## Architecture

### Core Contracts

1. **DeploymentRegistry** - Central registry for contract addresses
2. **GardenToken** - NFT contract for gardens
3. **ActionRegistry** - Registry for available actions
4. **WorkResolver** - Resolver for work attestations
5. **WorkApprovalResolver** - Resolver for work approval attestations

### Deployment Features

- **Deterministic Addresses**: All contracts use CREATE2 for predictable addresses
- **Network Aware**: Automatic configuration based on target network
- **Gas Optimization**: Built-in gas price monitoring and optimization
- **Comprehensive Validation**: Input validation for all configurations
- **Deployment Records**: Automatic saving of deployment information

## Documentation

For detailed deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](../../LICENSE) for details. 