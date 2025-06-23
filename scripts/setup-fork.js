#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NETWORKS = {
  arbitrum: {
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    forkBlock: 250000000, // Recent block
    contracts: {
      eas: '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458',
      schemaRegistry: '0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB',
    }
  },
  base: {
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    forkBlock: 20000000,
    contracts: {
      eas: '0x4200000000000000000000000000000000000021',
      schemaRegistry: '0x4200000000000000000000000000000000000020',
    }
  },
  celo: {
    chainId: 42220,
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    forkBlock: 25000000,
    contracts: {
      eas: '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458',
      schemaRegistry: '0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB',
    }
  }
};

function setupFork(networkName) {
  const network = NETWORKS[networkName];
  if (!network) {
    console.error(`❌ Unknown network: ${networkName}`);
    console.log(`Available networks: ${Object.keys(NETWORKS).join(', ')}`);
    process.exit(1);
  }

  console.log(`🔗 Setting up fork for ${networkName.toUpperCase()}`);
  console.log(`   Chain ID: ${network.chainId}`);
  console.log(`   Fork Block: ${network.forkBlock}`);
  console.log(`   RPC URL: ${network.rpcUrl}`);
  
  // Create network-specific environment variables file
  const envContent = `# Auto-generated for ${networkName} fork
FORK_NETWORK=${networkName}
FORK_CHAIN_ID=${network.chainId}
FORK_RPC_URL=${network.rpcUrl}
FORK_BLOCK=${network.forkBlock}
EAS_ADDRESS=${network.contracts.eas}
SCHEMA_REGISTRY_ADDRESS=${network.contracts.schemaRegistry}
`;

  // Ensure directories exist
  const contractsDir = path.join(process.cwd(), 'packages', 'contracts');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(contractsDir, `.env.${networkName}`), envContent);
  
  // Update foundry.toml with network-specific settings
  const foundryTomlPath = path.join(contractsDir, 'foundry.toml');
  const foundryConfig = `

[profile.local-${networkName}]
eth_rpc_url = "${network.rpcUrl}"
fork_block_number = ${network.forkBlock}
chain_id = ${network.chainId}
auto_impersonate = true
`;

  if (fs.existsSync(foundryTomlPath)) {
    // Check if this profile already exists
    const existingContent = fs.readFileSync(foundryTomlPath, 'utf-8');
    if (!existingContent.includes(`[profile.local-${networkName}]`)) {
      fs.appendFileSync(foundryTomlPath, foundryConfig);
    }
  }
  
  console.log(`✅ ${networkName.toUpperCase()} fork configuration ready`);
  console.log(`📁 Environment file: packages/contracts/.env.${networkName}`);
}

function main() {
  const network = process.argv[2] || process.env.FORK_NETWORK || 'arbitrum';
  
  console.log('🚀 Green Goods - Multi-Network Fork Setup');
  console.log('==========================================');
  
  setupFork(network);
  
  console.log(`
🎯 Next steps:
1. Edit packages/contracts/.env.${network} with your actual RPC URLs
2. Run: pnpm --filter contracts fork:${network}
3. In another terminal: pnpm --filter contracts deploy:local
4. Start the full environment: pnpm dev:full
`);
}

if (require.main === module) {
  main();
}

module.exports = { NETWORKS, setupFork }; 