#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test functions
async function testNodeVersion() {
  log('\n🔍 Checking Node.js version...', 'bright');
  
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].slice(1));
    
    if (majorVersion >= 20) {
      success(`Node.js ${nodeVersion} is compatible`);
      return true;
    } else {
      error(`Node.js ${nodeVersion} is too old. Please upgrade to v20 or higher`);
      return false;
    }
  } catch (err) {
    error(`Failed to check Node.js version: ${err.message}`);
    return false;
  }
}

async function testPnpmVersion() {
  log('\n🔍 Checking pnpm version...', 'bright');
  
  try {
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(pnpmVersion.split('.')[0]);
    
    if (majorVersion >= 9) {
      success(`pnpm ${pnpmVersion} is compatible`);
      return true;
    } else {
      error(`pnpm ${pnpmVersion} is too old. Please upgrade to v9 or higher`);
      return false;
    }
  } catch (err) {
    error(`pnpm not found. Please install it: npm install -g pnpm@9`);
    return false;
  }
}

async function testFoundryInstallation() {
  log('\n🔍 Checking Foundry installation...', 'bright');
  
  try {
    const forgeVersion = execSync('forge --version', { encoding: 'utf8' }).trim();
    success(`Foundry installed: ${forgeVersion}`);
    
    // Check anvil
    execSync('anvil --version', { encoding: 'utf8' });
    success('Anvil is available');
    
    return true;
  } catch (err) {
    error('Foundry not found. Please install it:');
    info('curl -L https://foundry.paradigm.xyz | bash');
    info('foundryup');
    return false;
  }
}

async function testEnvironmentFiles() {
  log('\n🔍 Checking environment files...', 'bright');
  
  const envFiles = [
    'packages/contracts/.env',
    'packages/client/.env',
    'packages/indexer/.env'
  ];
  
  let allExist = true;
  
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      success(`Found ${file}`);
      
      // Check for placeholder values
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('YOUR_') || content.includes('your_')) {
        warning(`${file} contains placeholder values. Please update with actual keys`);
      }
    } else {
      error(`Missing ${file}`);
      allExist = false;
    }
  }
  
  return allExist;
}

async function testNetworkConnectivity() {
  log('\n🔍 Testing network connectivity...', 'bright');
  
  const testUrl = async (url, name, isRpc = false) => {
    return new Promise((resolve) => {
      if (isRpc) {
        // For RPC endpoints, use POST with JSON-RPC
        const urlObj = new URL(url);
        const postData = JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        });
        
        const options = {
          hostname: urlObj.hostname,
          port: 443,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const req = https.request(options, (res) => {
          if (res.statusCode === 200) {
            success(`${name} is reachable`);
            resolve(true);
          } else {
            warning(`${name} returned status ${res.statusCode}`);
            resolve(false);
          }
        });
        
        req.on('error', (err) => {
          error(`${name} is not reachable: ${err.message}`);
          resolve(false);
        });
        
        req.write(postData);
        req.end();
      } else {
        // For regular APIs, use GET
        https.get(url, (res) => {
          if (res.statusCode === 200 || res.statusCode === 401) {
            success(`${name} is reachable`);
            resolve(true);
          } else {
            warning(`${name} returned status ${res.statusCode}`);
            resolve(false);
          }
        }).on('error', (err) => {
          error(`${name} is not reachable: ${err.message}`);
          resolve(false);
        });
      }
    });
  };
  
  const results = await Promise.all([
    testUrl('https://api.github.com', 'GitHub API', false),
    testUrl('https://arb1.arbitrum.io/rpc', 'Arbitrum RPC', true),
    testUrl('https://mainnet.base.org', 'Base RPC', true)
  ]);
  
  return results.every(r => r);
}

async function testLocalServices() {
  log('\n🔍 Checking local services...', 'bright');
  
  // Check if anvil is running
  try {
    const response = await fetch('http://localhost:8545', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    if (response.ok) {
      success('Anvil is running on port 8545');
      return true;
    }
  } catch (err) {
    warning('Anvil is not running. Run `pnpm dev:full` to start it');
  }
  
  // Check PostgreSQL for indexer
  try {
    execSync('psql -U postgres -c "SELECT version();"', { encoding: 'utf8' });
    success('PostgreSQL is available');
  } catch (err) {
    warning('PostgreSQL not found. The indexer will need a database to run');
    info('Install PostgreSQL or use Docker: docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres');
  }
  
  return true;
}

async function testContractCompilation() {
  log('\n🔍 Testing contract compilation...', 'bright');
  
  try {
    info('Compiling contracts...');
    execSync('pnpm --filter contracts compile', { stdio: 'inherit' });
    success('Contracts compiled successfully');
    return true;
  } catch (err) {
    error('Contract compilation failed');
    return false;
  }
}

async function testDeploymentFiles() {
  log('\n🔍 Checking deployment files...', 'bright');
  
  const deploymentFile = 'packages/contracts/deployments/local.json';
  
  if (fs.existsSync(deploymentFile)) {
    success('Found local deployment file');
    
    try {
      const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      
      if (deployment.contracts && deployment.schemas) {
        success('Deployment file structure is valid');
        info(`Chain ID: ${deployment.chainId}`);
        info(`Contracts deployed: ${Object.keys(deployment.contracts).length}`);
        info(`Schemas registered: ${Object.keys(deployment.schemas).length}`);
        return true;
      }
    } catch (err) {
      error(`Invalid deployment file: ${err.message}`);
      return false;
    }
  } else {
    info('No deployment file found yet. Run `pnpm dev:full` to deploy');
    return true;
  }
}

async function testDependencies() {
  log('\n🔍 Checking dependencies...', 'bright');
  
  try {
    info('Verifying installations...');
    
    // Check if node_modules exist
    const packages = ['contracts', 'client', 'indexer'];
    let allInstalled = true;
    
    for (const pkg of packages) {
      const nodeModulesPath = path.join('packages', pkg, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        success(`${pkg} dependencies installed`);
      } else {
        error(`${pkg} dependencies missing`);
        allInstalled = false;
      }
    }
    
    if (!allInstalled) {
      info('Run `pnpm install` to install missing dependencies');
      return false;
    }
    
    return true;
  } catch (err) {
    error(`Failed to check dependencies: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  log('🚀 Green Goods Setup Validator', 'bright');
  log('=====================================\n', 'bright');
  
  const tests = [
    { name: 'Node.js Version', test: testNodeVersion },
    { name: 'pnpm Version', test: testPnpmVersion },
    { name: 'Foundry Installation', test: testFoundryInstallation },
    { name: 'Environment Files', test: testEnvironmentFiles },
    { name: 'Dependencies', test: testDependencies },
    { name: 'Contract Compilation', test: testContractCompilation },
    { name: 'Network Connectivity', test: testNetworkConnectivity },
    { name: 'Local Services', test: testLocalServices },
    { name: 'Deployment Files', test: testDeploymentFiles }
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    try {
      const result = await test();
      results.push({ name, passed: result });
    } catch (err) {
      error(`Test failed: ${err.message}`);
      results.push({ name, passed: false });
    }
  }
  
  // Summary
  log('\n📊 Test Summary', 'bright');
  log('=====================================', 'bright');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(({ name, passed }) => {
    log(`${passed ? '✅' : '❌'} ${name}`, passed ? 'green' : 'red');
  });
  
  log('\n=====================================', 'bright');
  log(`Total: ${passed} passed, ${failed} failed`, 'bright');
  
  if (failed === 0) {
    success('\n🎉 All tests passed! Your setup is ready.');
    info('Run `pnpm dev:full` to start the development environment');
  } else {
    warning('\n⚠️  Some tests failed. Please fix the issues above.');
    info('After fixing, run this test again: `node scripts/test-setup.js`');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runAllTests().catch(err => {
    error(`Test runner failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runAllTests }; 