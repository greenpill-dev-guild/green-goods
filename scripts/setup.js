#!/usr/bin/env node

/**
 * Green Goods Setup Script
 * 
 * Checks dependencies, installs packages, and configures environment
 */

const fs = require('fs');
const { execSync } = require('child_process');

// Simple color helpers
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

const log = {
  info: (msg) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}✓${c.reset}  ${msg}`),
  warning: (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error: (msg) => console.log(`${c.red}✗${c.reset}  ${msg}`)
};

function checkCommand(cmd, name) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    log.error(`${name} not found`);
    return false;
  }
}

function checkVersion(cmd, minVersion, name) {
  try {
    const version = execSync(`${cmd} --version`, { encoding: 'utf8' }).trim();
    const match = version.match(/(\d+)/);
    if (match && parseInt(match[1]) >= minVersion) {
      log.success(`${name} ${version.split('\n')[0]}`);
      return true;
    }
    log.error(`${name} version ${minVersion}+ required`);
    return false;
  } catch {
    log.error(`${name} not found`);
    return false;
  }
}

function checkDocker() {
  try {
    execSync('docker ps', { stdio: 'ignore' });
    const version = execSync('docker --version', { encoding: 'utf8' }).trim();
    log.success(version);
    return true;
  } catch {
    log.error('Docker not running or not installed');
    return false;
  }
}

console.log(`\n${c.green}🌱 Green Goods Setup${c.reset}\n`);

// Check dependencies
log.info('Checking dependencies...\n');
const hasNode = checkVersion('node', 20, 'Node.js');
const hasPnpm = checkVersion('pnpm', 9, 'pnpm');
const hasGit = checkCommand('git', 'Git');
const hasDocker = checkDocker();
const hasForge = checkCommand('forge', 'Foundry');

console.log('');

if (!hasNode || !hasPnpm || !hasGit) {
  log.error('Missing required dependencies. Install them and try again.\n');
  console.log(`${c.dim}Required:${c.reset}
  • Node.js 20+: https://nodejs.org
  • pnpm 9+: npm install -g pnpm
  • Git: https://git-scm.com\n`);
  process.exit(1);
}

if (!hasDocker) {
  log.warning('Docker not running. Required for indexer development.');
}

if (!hasForge) {
  log.warning('Foundry not found. Required for contract development.');
  console.log(`${c.dim}Install: curl -L https://foundry.paradigm.xyz | bash && foundryup${c.reset}\n`);
}

// Install dependencies
if (!fs.existsSync('node_modules')) {
  log.info('Installing dependencies...\n');
  try {
    execSync('pnpm install', { stdio: 'inherit' });
    log.success('Dependencies installed\n');
  } catch {
    log.error('Failed to install dependencies\n');
    process.exit(1);
  }
} else {
  log.success('Dependencies already installed\n');
}

// Setup environment
if (!fs.existsSync('.env')) {
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    log.success('Created .env from template\n');
    
    console.log(`${c.cyan}Configure these services:${c.reset}
  • Privy (Auth): https://console.privy.io
  • Pinata (IPFS): https://pinata.cloud
  • Envio (Indexer): https://envio.dev
  
See .env for all variables.\n`);
  } else {
    log.warning('No .env.example found\n');
  }
} else {
  log.success('Environment already configured\n');
}

// Next steps
console.log(`${c.green}✓ Setup complete!${c.reset}\n`);
console.log(`${c.cyan}Next steps:${c.reset}
  1. Edit .env with your API keys
  2. Start services: pnpm dev
  3. Run tests: pnpm test

${c.dim}Individual packages:${c.reset}
  • pnpm dev:client    - React PWA (port 5173)
  • pnpm dev:indexer   - Blockchain indexer (port 8081)
  • pnpm dev:contracts - Local blockchain (Anvil)
`);