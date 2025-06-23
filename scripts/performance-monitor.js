#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');

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

// Performance monitoring functions
async function checkAnvilPerformance() {
  try {
    const start = Date.now();
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
    
    const duration = Date.now() - start;
    const result = await response.json();
    
    if (response.ok && result.result) {
      const blockNumber = parseInt(result.result, 16);
      success(`Anvil: Block #${blockNumber} (${duration}ms response time)`);
      
      if (duration > 1000) {
        warning('Anvil response time is slow. Consider optimizing fork block number.');
      }
      
      return { healthy: true, responseTime: duration, blockNumber };
    } else {
      error('Anvil: Failed to get block number');
      return { healthy: false };
    }
  } catch (err) {
    error(`Anvil: Connection failed - ${err.message}`);
    return { healthy: false };
  }
}

async function checkClientPerformance() {
  const ports = [3001, 5173, 3000, 4173, 5174];
  
  for (const port of ports) {
    // Try HTTPS first, then HTTP
    for (const protocol of ['https', 'http']) {
      try {
        const start = Date.now();
        // Use a custom agent to ignore SSL certificate errors for local development
        const https = require('https');
        const agent = new https.Agent({ rejectUnauthorized: false });
        
        const response = await fetch(`${protocol}://localhost:${port}`, {
          timeout: 5000,
          ...(protocol === 'https' ? { agent } : {})
        });
        const duration = Date.now() - start;
        
        if (response.ok) {
          success(`Client: Running on ${protocol}://localhost:${port} (${duration}ms response time)`);
          return { healthy: true, port, protocol, responseTime: duration };
        }
      } catch (err) {
        // Continue to next protocol/port
      }
    }
  }
  
  warning('Client: No running instance found on common ports');
  return { healthy: false };
}

async function checkIndexerStatus() {
  try {
    // Check if envio process is running
    return new Promise((resolve) => {
      exec('ps aux | grep envio | grep -v grep', (err, stdout) => {
        if (stdout.trim()) {
          success('Indexer: Envio process is running');
          resolve({ healthy: true });
        } else {
          warning('Indexer: Envio process not found');
          resolve({ healthy: false });
        }
      });
    });
  } catch (err) {
    error(`Indexer: Status check failed - ${err.message}`);
    return { healthy: false };
  }
}

async function checkContractDeployments() {
  const deploymentPath = 'packages/contracts/deployments/local.json';
  
  if (!fs.existsSync(deploymentPath)) {
    error('Contracts: Deployment file not found');
    return { healthy: false };
  }
  
  try {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const contractCount = Object.keys(deployment.contracts || {}).length;
    const schemaCount = Object.keys(deployment.schemas || {}).length;
    
    success(`Contracts: ${contractCount} contracts deployed, ${schemaCount} schemas registered`);
    
    // Test a contract call
    const start = Date.now();
    const response = await fetch('http://localhost:8545', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getCode',
        params: [deployment.contracts.eas, 'latest'],
        id: 1
      })
    });
    
    const result = await response.json();
    const duration = Date.now() - start;
    
    if (result.result && result.result !== '0x') {
      success(`Contracts: EAS contract verified (${duration}ms)`);
      return { healthy: true, contractCount, schemaCount };
    } else {
      error('Contracts: EAS contract not found on chain');
      return { healthy: false };
    }
  } catch (err) {
    error(`Contracts: Deployment check failed - ${err.message}`);
    return { healthy: false };
  }
}

async function checkSystemResources() {
  return new Promise((resolve) => {
    exec('ps aux | grep -E "(anvil|vite|envio|node)" | grep -v grep', (err, stdout) => {
      if (err) {
        resolve({ processes: 0, memoryUsage: 0 });
        return;
      }
      
      const processes = stdout.trim().split('\n').filter(line => line.trim());
      let totalMemory = 0;
      
      for (const process of processes) {
        const parts = process.split(/\s+/);
        if (parts.length > 5) {
          // RSS memory is typically in column 5 (0-indexed)
          const memory = parseFloat(parts[5]) || 0;
          totalMemory += memory;
        }
      }
      
      info(`System: ${processes.length} development processes using ~${Math.round(totalMemory / 1024)}MB memory`);
      
      if (totalMemory > 2000000) { // > 2GB
        warning('System: High memory usage detected. Consider restarting services.');
      }
      
      resolve({ processes: processes.length, memoryUsage: totalMemory });
    });
  });
}

// Optimization recommendations
function generateOptimizationReport(results) {
  info('\n📊 Performance Report & Optimization Recommendations');
  info('====================================================');
  
  const recommendations = [];
  
  // Anvil optimizations
  if (results.anvil.healthy && results.anvil.responseTime > 500) {
    recommendations.push({
      service: 'Anvil',
      issue: 'Slow response time',
      recommendation: 'Consider using a more recent fork block number or a faster RPC endpoint'
    });
  }
  
  // Client optimizations
  if (results.client.healthy && results.client.responseTime > 1000) {
    recommendations.push({
      service: 'Client',
      issue: 'Slow startup',
      recommendation: 'Enable Vite HMR optimizations and consider using Rolldown for faster builds'
    });
  }
  
  // Indexer optimizations
  if (!results.indexer.healthy) {
    recommendations.push({
      service: 'Indexer',
      issue: 'Not running',
      recommendation: 'Start the indexer with optimized batch settings: pnpm --filter indexer dev:local'
    });
  }
  
  // System optimizations
  if (results.system.processes > 20) {
    recommendations.push({
      service: 'System',
      issue: 'Too many processes',
      recommendation: 'Consider using the optimized dev script instead of individual services'
    });
  }
  
  if (recommendations.length === 0) {
    success('🎉 All services are performing optimally!');
  } else {
    warning(`Found ${recommendations.length} optimization opportunities:`);
    recommendations.forEach((rec, index) => {
      log(`\n${index + 1}. ${rec.service}: ${rec.issue}`, 'yellow');
      log(`   💡 ${rec.recommendation}`, 'cyan');
    });
  }
  
  // Additional optimizations
  info('\n🚀 Additional Performance Tips:');
  info('• Use pnpm dev:optimized for better resource management');
  info('• Set NODE_ENV=development for better debugging');
  info('• Consider using local IPFS node for faster media uploads');
  info('• Enable React DevTools for better debugging experience');
  info('• Use browser dev tools Network tab to monitor API calls');
}

async function main() {
  info('🔍 Green Goods Performance Monitor');
  info('=====================================\n');
  
  const results = {};
  
  try {
    // Check all services
    results.anvil = await checkAnvilPerformance();
    results.client = await checkClientPerformance();
    results.indexer = await checkIndexerStatus();
    results.contracts = await checkContractDeployments();
    results.system = await checkSystemResources();
    
    // Generate report
    generateOptimizationReport(results);
    
    // Summary
    const healthyServices = Object.values(results).filter(r => r.healthy).length;
    const totalServices = Object.keys(results).length;
    
    info(`\n📈 Overall Health: ${healthyServices}/${totalServices} services healthy`);
    
    if (healthyServices === totalServices) {
      success('🎯 Development environment is fully operational!');
    } else {
      warning(`⚠️  ${totalServices - healthyServices} service(s) need attention`);
    }
    
  } catch (err) {
    error(`Performance check failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    error(`Monitor failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { 
  checkAnvilPerformance,
  checkClientPerformance,
  checkIndexerStatus,
  checkContractDeployments,
  checkSystemResources
}; 