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
# Deploy to Sepolia testnet
pnpm deploy:sepolia

# Deploy to Celo mainnet with verification
pnpm deploy:celo --verify

# Deploy with specific profile
pnpm deploy:celo --profile production

# Check gas prices before deployment
pnpm gas:check
```

### Configuration Management

**Environment Variables:**
Create a `.env` file in the contracts directory:
```bash
# Required for deployment
DEPLOYER_PRIVATE_KEY=0x...

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

**Network Configuration:**
Networks are configured in `deployments/networks.json`. The system automatically validates:
- RPC connectivity
- Chain ID matching
- Contract address requirements
- Environment variable references

**Deployment Profiles:**
Use deployment profiles for different scenarios:
```bash
# Quick testing deployment
pnpm deploy:test --network sepolia

# Full production deployment
pnpm deploy:prod --network celo

# Update existing deployment
pnpm deploy:update --network celo

# Deploy only schemas
pnpm deploy:schemas --network sepolia
```

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
# Verify environment variables
echo $DEPLOYER_PRIVATE_KEY | wc -c  # Should be 66 characters
echo $CELO_RPC_URL

# Test private key format
cast wallet address $DEPLOYER_PRIVATE_KEY
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