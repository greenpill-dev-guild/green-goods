#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ENV_TEMPLATES = {
  contracts: `# =================================
# NETWORK FORKING CONFIGURATION
# =================================

# Choose which network to fork (uncomment one)
# FORK_NETWORK=arbitrum
# FORK_NETWORK=base
# FORK_NETWORK=celo
FORK_NETWORK=arbitrum

# Network RPC URLs - REPLACE WITH YOUR ACTUAL RPC URLS
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
CELO_RPC_URL=https://forno.celo.org
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Local Development
LOCAL_RPC_URL=http://localhost:8545
LOCAL_CHAIN_ID=31337

# Deployment Configuration (DEFAULT TEST KEYS - NEVER USE IN PRODUCTION)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
DEPLOYER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# API Keys
API_KEY_ETHERSCAN=YOUR_ETHERSCAN_API_KEY
API_KEY_ARBISCAN=YOUR_ARBISCAN_API_KEY
API_KEY_BASESCAN=YOUR_BASESCAN_API_KEY

# EAS Addresses per Network (auto-configured)
EAS_ARBITRUM=0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458
EAS_BASE=0x4200000000000000000000000000000000000021
EAS_CELO=0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458

SCHEMA_REGISTRY_ARBITRUM=0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB
SCHEMA_REGISTRY_BASE=0x4200000000000000000000000000000000000020
SCHEMA_REGISTRY_CELO=0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB

# Local Development Addresses (populated after deployment)
LOCAL_GARDEN_TOKEN=
LOCAL_ACTION_REGISTRY=
LOCAL_WORK_RESOLVER=
LOCAL_WORK_APPROVAL_RESOLVER=
LOCAL_EAS=
LOCAL_SCHEMA_REGISTRY=`,

  client: `# Authentication
VITE_PRIVY_APP_ID=your_privy_app_id

# IPFS/Pinata Configuration
VITE_PINATA_JWT=your_pinata_jwt
VITE_PINATA_GATEWAY_URL=https://gateway.pinata.cloud

# Whisk API
VITE_WHISK_API_KEY=your_whisk_api_key

# Local Development
VITE_LOCAL_RPC_URL=http://localhost:8545
VITE_LOCAL_CHAIN_ID=31337
VITE_LOCAL_INDEXER_URL=http://localhost:8080

# Production URLs
VITE_ENVIO_INDEXER_URL=https://indexer.hypersync.xyz/4e02df79-f0c7-498a-9df6-8a4a1c9c8dd4

# Analytics
VITE_PUBLIC_POSTHOG_KEY=your_posthog_key
VITE_PUBLIC_POSTHOG_HOST=https://app.posthog.com`,

  indexer: `# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/greengoods_indexer

# Network Configuration
LOCAL_RPC_URL=http://localhost:8545
LOCAL_CHAIN_ID=31337

# Envio API Token (Required for production/self-hosted deployments from May 2025)
# Get your token from: https://envio.dev/dashboard
# For local development, this is optional but may have rate limits
ENVIO_API_TOKEN=`
};

function createEnvFile(packageName, content) {
  const envPath = path.join('packages', packageName, '.env.example');
  const envPathReal = path.join('packages', packageName, '.env');
  
  // Ensure package directory exists
  const packageDir = path.dirname(envPath);
  if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir, { recursive: true });
  }
  
  // Create .env.example
  fs.writeFileSync(envPath, content);
  console.log(`✅ Created ${envPath}`);
  
  // Create .env if it doesn't exist
  if (!fs.existsSync(envPathReal)) {
    fs.writeFileSync(envPathReal, content);
    console.log(`✅ Created ${envPathReal}`);
  } else {
    console.log(`ℹ️  ${envPathReal} already exists`);
  }
}

function main() {
  console.log('🚀 Green Goods - Environment Setup');
  console.log('==================================');
  
  // Create environment files for each package
  createEnvFile('contracts', ENV_TEMPLATES.contracts);
  createEnvFile('client', ENV_TEMPLATES.client);
  createEnvFile('indexer', ENV_TEMPLATES.indexer);
  
  console.log(`
📝 Environment files created!

🔧 Next steps:
1. Edit the .env files with your actual API keys:
   - packages/contracts/.env (RPC URLs)
   - packages/client/.env (Privy, Pinata keys)
   - packages/indexer/.env (Database URL)

2. Run the setup: pnpm setup:local
3. Start development: pnpm dev:full

⚠️  Important: 
- Never commit real API keys or private keys
- The default private key is for testing only
- Replace YOUR_* placeholders with actual values
  `);
}

if (require.main === module) {
  main();
}

module.exports = { ENV_TEMPLATES, createEnvFile }; 