#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Health check functions
async function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`, {
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
        return true;
      }
    } catch (err) {
      // Port not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function checkContractsDeployed() {
  const deploymentPath = path.join(process.cwd(), 'packages/contracts/deployments/local.json');
  return fs.existsSync(deploymentPath);
}

// Service management
class ServiceManager {
  constructor() {
    this.services = new Map();
    this.cleanup = [];
  }
  
  async startService(name, command, cwd, color = 'cyan') {
    info(`Starting ${name}...`);
    
    const child = spawn('sh', ['-c', command], {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    child.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        log(`[${name}] ${message}`, color);
      }
    });
    
    child.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message && !message.includes('ExperimentalWarning')) {
        log(`[${name}] ${message}`, 'yellow');
      }
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        error(`${name} exited with code ${code}`);
      }
    });
    
    this.services.set(name, child);
    this.cleanup.push(() => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    });
    
    return child;
  }
  
  async stop() {
    info('Shutting down services...');
    
    for (const cleanup of this.cleanup) {
      try {
        cleanup();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    
    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Force kill any remaining processes
    try {
      exec('pkill -f anvil', () => {});
      exec('pkill -f envio', () => {});
      exec('pkill -f vite', () => {});
    } catch (err) {
      // Ignore errors
    }
  }
}

async function main() {
  const manager = new ServiceManager();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    info('\nReceived SIGINT, shutting down...');
    await manager.stop();
    process.exit(0);
  });
  
  try {
    info('🚀 Starting Green Goods Optimized Development Environment');
    info('===========================================================');
    
    // 1. Setup fork environment
    info('Setting up fork environment...');
    await new Promise((resolve, reject) => {
      exec('node scripts/setup-fork.js arbitrum', (err, stdout) => {
        if (err) {
          error(`Fork setup failed: ${err.message}`);
          reject(err);
          return;
        }
        success('Fork environment configured');
        resolve();
      });
    });
    
    // 2. Update RPC URL
    const envPath = 'packages/contracts/.env.arbitrum';
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(
        /FORK_RPC_URL=.*/,
        'FORK_RPC_URL=https://arbitrum-one.publicnode.com'
      );
      
      // Add private key if not present
      if (!envContent.includes('PRIVATE_KEY')) {
        envContent += '\nPRIVATE_KEY="0x5aeb02936a1c866c306bd515ab23f692431e3bcc350a6f1e9f3f7ad8a9085b52"';
      }
      
      fs.writeFileSync(envPath, envContent);
      success('Environment variables updated');
    }
    
    // 3. Start Anvil fork
    info('Starting Anvil fork...');
    await manager.startService(
      'ANVIL',
      'source .env.arbitrum && anvil --fork-url $FORK_RPC_URL --chain-id 31337 --config-out localhost.json --gas-limit 30000000 --host 0.0.0.0 --silent',
      'packages/contracts',
      'red'
    );
    
    info('Waiting for Anvil to be ready...');
    const anvilReady = await waitForPort(8545);
    if (!anvilReady) {
      throw new Error('Anvil failed to start within timeout');
    }
    success('Anvil is ready on port 8545');
    
    // 4. Deploy contracts (always redeploy for fresh anvil instance)
    info('Deploying contracts...');
    await new Promise((resolve, reject) => {
        exec('pnpm deploy:local', {
          cwd: 'packages/contracts'
        }, (err, stdout, stderr) => {
          if (err && !stdout.includes('deployed at:')) {
            error(`Contract deployment failed: ${err.message}`);
            reject(err);
            return;
          }
          
          // Manual file creation if needed
          const deploymentPath = 'packages/contracts/deployments/local.json';
          if (!fs.existsSync(deploymentPath)) {
            const addresses = {
              chainId: 31337,
              name: 'Local Development',
              rpcUrl: 'http://localhost:8545',
              contracts: {},
              schemas: {}
            };
            
            // Extract addresses from output
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.includes('deployed at:')) {
                const match = line.match(/(\w+) deployed at: (0x[a-fA-F0-9]{40})/);
                if (match) {
                  const [, name, address] = match;
                  addresses.contracts[name.toLowerCase()] = address;
                }
              }
            }
            
            fs.writeFileSync(deploymentPath, JSON.stringify(addresses, null, 2));
            exec('node ../../scripts/copy-deployment.js', { cwd: 'packages/contracts' });
          }
          
          // Update indexer config with deployment addresses
          exec('node scripts/update-indexer-config.js', (updateErr) => {
            if (updateErr) {
              warning('Failed to update indexer config - will need manual update');
            }
          });
          
          success('Contracts deployed successfully');
          resolve();
        });
      });
    
    // 5. Setup database for indexer
    info('Setting up database for indexer...');
    try {
      const dbSetup = require('./setup-db');
      const hasDocker = await dbSetup.checkDocker();
      if (hasDocker) {
        await dbSetup.startPostgreSQLDocker();
        success('Database ready for indexer');
      } else {
        warning('PostgreSQL/Docker not found - indexer may fail to start');
      }
    } catch (err) {
      warning(`Database setup skipped: ${err.message}`);
    }
    
    // 6. Start Indexer (with optimized config)
    info('Starting Envio indexer...');
    await manager.startService(
      'INDEXER',
      'pnpm envio dev --config config.local.yaml',
      'packages/indexer',
      'yellow'
    );
    
    // 7. Start Client
    info('Starting React client...');
    await manager.startService(
      'CLIENT',
      'pnpm dev',
      'packages/client',
      'magenta'
    );
    
    // Wait a bit for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    success('🎉 All services started successfully!');
    info('===========================================================');
    info('Available services:');
    info('   📡 Anvil Fork: http://localhost:8545');
    info('   🔗 Client App: https://localhost:3001');
    info('   📊 Indexer: Running in background');
    info('===========================================================');
    info('Press Ctrl+C to stop all services');
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (err) {
    error(`Failed to start development environment: ${err.message}`);
    await manager.stop();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    error(`Startup failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { ServiceManager }; 