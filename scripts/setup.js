#!/usr/bin/env node

/**
 * Green Goods Project Assistant
 * 
 * A comprehensive setup and management tool for the Green Goods monorepo
 * - Checks dependencies
 * - Sets up environment
 * - Manages package development/testing/building
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

// ANSI color codes for better UX
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  dim: (msg) => console.log(`${colors.dim}${msg}${colors.reset}`)
};

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function select(prompt, options) {
  console.log(`\n${prompt}`);
  options.forEach((opt, index) => {
    console.log(`  ${colors.cyan}${index + 1})${colors.reset} ${opt.label}`);
  });
  
  while (true) {
    const answer = await question(`\nSelect (1-${options.length}): `);
    const selection = parseInt(answer);
    if (selection >= 1 && selection <= options.length) {
      return options[selection - 1];
    }
    log.error('Invalid selection. Please try again.');
  }
}

// Dependency checkers
function checkCommand(command, installInstructions) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return { available: true };
  } catch {
    return { 
      available: false, 
      command, 
      instructions: installInstructions 
    };
  }
}

function checkNodeVersion() {
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    const major = parseInt(version.split('.')[0].substring(1));
    if (major >= 20) {
      return { available: true, version, command: 'node' };
    }
    return { 
      available: false, 
      command: 'node', 
      instructions: 'Node.js >= 20.x required. Visit https://nodejs.org' 
    };
  } catch {
    return { 
      available: false, 
      command: 'node', 
      instructions: 'Node.js >= 20.x required. Visit https://nodejs.org' 
    };
  }
}

function checkPnpmVersion() {
  try {
    const version = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const major = parseInt(version.split('.')[0]);
    if (major >= 9) {
      return { available: true, version, command: 'pnpm' };
    }
    return { 
      available: false, 
      command: 'pnpm', 
      instructions: 'pnpm >= 9.x required. Run: npm install -g pnpm' 
    };
  } catch {
    return { 
      available: false, 
      command: 'pnpm', 
      instructions: 'pnpm >= 9.x required. Run: npm install -g pnpm' 
    };
  }
}

function checkDockerVersion() {
  try {
    const version = execSync('docker --version', { encoding: 'utf8' }).trim();
    // Also check if Docker daemon is running
    execSync('docker ps', { stdio: 'ignore' });
    return { available: true, version: version.replace('Docker version ', ''), command: 'docker' };
  } catch {
    return { 
      available: false, 
      command: 'docker', 
      instructions: 'Docker is required and must be running. Visit https://docker.com' 
    };
  }
}

async function checkDependencies() {
  log.header('🔍 Checking Dependencies');
  
  const checks = [
    checkNodeVersion(),
    checkPnpmVersion(),
    checkCommand('git', 'Git is required. Visit https://git-scm.com'),
    checkDockerVersion(),
    checkCommand('forge', 'Foundry is required for contracts. Run: pnpm foundry:up'),
  ];
  
  const missing = checks.filter(check => !check.available);
  const available = checks.filter(check => check.available);
  
  // Show available dependencies
  available.forEach(dep => {
    if (dep.version) {
      log.success(`${dep.command} ${dep.version}`);
    } else {
      log.success(`${dep.command || 'Dependency'} available`);
    }
  });
  
  if (missing.length > 0) {
    log.warning('Missing dependencies:');
    missing.forEach(dep => {
      log.error(`${dep.command}: ${dep.instructions}`);
    });
    
    const proceed = await question('\nSome dependencies are missing. Continue anyway? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      process.exit(1);
    }
  } else {
    log.success('All core dependencies installed!');
  }
  
  return missing;
}

async function setupEnvironment() {
  log.header('🔧 Environment Setup');
  
  const envExists = fs.existsSync('.env');
  if (envExists) {
    log.info('.env file already exists');
    const overwrite = await question('Do you want to reconfigure it? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      return;
    }
  }
  
  // Copy template
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    log.success('Created .env from template');
  } else {
    log.warning('No .env.example found. Creating empty .env');
    fs.writeFileSync('.env', '');
  }
  
  // Guide for services
  log.info('\nRequired services for full functionality:');
  console.log(`
  ${colors.bright}Core Services:${colors.reset}
  • ${colors.cyan}Privy${colors.reset} (Auth): https://console.privy.io
    - VITE_PRIVY_APP_ID, PRIVY_APP_SECRET
  • ${colors.cyan}Pinata${colors.reset} (IPFS): https://pinata.cloud
    - VITE_PINATA_JWT
  • ${colors.cyan}Envio${colors.reset} (Indexer): https://envio.dev
    - ENVIO_API_TOKEN
    
  ${colors.bright}Optional Services:${colors.reset}
  • ${colors.cyan}Alchemy${colors.reset} (RPC): https://alchemy.com
    - ALCHEMY_API_KEY
  • ${colors.cyan}PostHog${colors.reset} (Analytics): https://posthog.com
    - VITE_PUBLIC_POSTHOG_KEY
    
  ${colors.bright}Development:${colors.reset}
  • ${colors.cyan}Foundry Keystore${colors.reset} (Deployments): 
    - FOUNDRY_KEYSTORE_ACCOUNT (for secure contract deployments)
    - Setup: cast wallet import <account-name> --interactive
  `);
  
  const editNow = await question('Would you like to edit .env now? (y/N): ');
  if (editNow.toLowerCase() === 'y') {
    const editor = process.env.EDITOR || 'nano';
    try {
      execSync(`${editor} .env`, { stdio: 'inherit' });
    } catch {
      log.warning('Could not open editor. Please edit .env manually.');
    }
  }
}

// Package configurations
const packages = {
  all: {
    name: 'All Packages',
    path: '.',
    commands: {
      dev: 'pnpm dev',
      test: 'pnpm test:all',
      build: 'pnpm build',
      'test:e2e': 'pnpm test:e2e',
      'test:offline': 'pnpm test:offline'
    },
    description: 'Run all services together (client, api, indexer)',
    pm2: true
  },
  client: {
    name: 'Client (React PWA)',
    path: 'packages/client',
    commands: {
      dev: 'pnpm dev',
      test: 'pnpm test',
      'test:watch': 'pnpm test:watch',
      build: 'pnpm build',
      preview: 'pnpm preview',
      lint: 'pnpm lint'
    },
    description: 'Frontend React application with offline support',
    port: 5173
  },
  api: {
    name: 'API Server',
    path: 'packages/api', 
    commands: {
      dev: 'pnpm dev',
      build: 'pnpm build',
      start: 'pnpm start',
      lint: 'pnpm lint'
    },
    description: 'Fastify API server for authentication',
    port: 8080
  },
  indexer: {
    name: 'Blockchain Indexer',
    path: 'packages/indexer',
    commands: {
      dev: 'pnpm dev',
      test: 'pnpm test',
      codegen: 'pnpm codegen',
      build: 'pnpm build'
    },
    description: 'Envio indexer for blockchain events',
    port: 8081
  },
  contracts: {
    name: 'Smart Contracts',
    path: 'packages/contracts',
    commands: {
      test: 'pnpm test',
      build: 'pnpm build',
      deploy: 'pnpm deploy',
      'deploy:local': 'pnpm deploy:local',
      'deploy:sepolia': 'pnpm deploy:sepolia',
      'deploy:celo': 'pnpm deploy:celo',
      chain: 'pnpm chain',
      lint: 'pnpm lint'
    },
    description: 'Solidity smart contracts (Foundry)',
    requiresFoundry: true
  }
};

async function runCommand(pkg, command, commandStr) {
  log.info(`Running: ${commandStr}`);
  
  const [cmd, ...args] = commandStr.split(' ');
  const options = {
    cwd: pkg.path === '.' ? process.cwd() : path.join(process.cwd(), pkg.path),
    stdio: 'inherit',
    shell: true
  };
  
  return new Promise((resolve) => {
    const child = spawn(cmd, args, options);
    child.on('close', (code) => {
      if (code === 0) {
        log.success(`${command} completed successfully`);
      } else {
        log.error(`${command} failed with exit code ${code}`);
      }
      resolve(code);
    });
  });
}

async function installDependencies() {
  log.header('📦 Installing Dependencies');
  
  const shouldInstall = await question('Install/update dependencies? (Y/n): ');
  if (shouldInstall.toLowerCase() === 'n') {
    return;
  }
  
  log.info('Running pnpm install...');
  try {
    execSync('pnpm install', { stdio: 'inherit' });
    log.success('Dependencies installed successfully!');
  } catch (error) {
    log.error('Failed to install dependencies');
    throw error;
  }
}

async function packageMenu(pkg) {
  while (true) {
    log.header(`📦 ${pkg.name}`);
    log.dim(pkg.description);
    if (pkg.port) {
      log.dim(`Default port: ${pkg.port}`);
    }
    
    const options = [
      ...Object.entries(pkg.commands).map(([key, cmd]) => ({
        label: `${key.charAt(0).toUpperCase() + key.slice(1).replace(/:/g, ' ')} (${cmd})`,
        value: key,
        command: cmd
      })),
      { label: 'Back to main menu', value: 'back' }
    ];
    
    const selection = await select('What would you like to do?', options);
    
    if (selection.value === 'back') {
      break;
    }
    
    if (pkg.requiresFoundry && (selection.value.includes('deploy') || selection.value === 'test' || selection.value === 'build')) {
      const foundryCheck = checkCommand('forge', '');
      if (!foundryCheck.available) {
        log.error('Foundry is required for this command. Run: pnpm foundry:up');
        continue;
      }
    }
    
    await runCommand(pkg, selection.value, selection.command);
    
    const continueChoice = await question('\nPress Enter to continue...');
  }
}

async function quickActions() {
  const actions = [
    {
      label: 'Start all services (dev mode)',
      action: async () => {
        log.info('Starting all services with PM2...');
        await runCommand(packages.all, 'dev', packages.all.commands.dev);
      }
    },
    {
      label: 'Run all tests',
      action: async () => {
        log.info('Running all tests...');
        await runCommand(packages.all, 'test', packages.all.commands.test);
      }
    },
    {
      label: 'Run E2E tests',
      action: async () => {
        log.info('Running E2E tests...');
        await runCommand(packages.all, 'test:e2e', packages.all.commands['test:e2e']);
      }
    },
    {
      label: 'Run offline tests',
      action: async () => {
        log.info('Running offline tests...');
        await runCommand(packages.all, 'test:offline', packages.all.commands['test:offline']);
      }
    },
    {
      label: 'Check PM2 status',
      action: async () => {
        try {
          execSync('pnpm exec pm2 list', { stdio: 'inherit' });
        } catch {
          log.warning('PM2 not running or no processes found');
        }
      }
    },
    {
      label: 'Stop all PM2 services',
      action: async () => {
        try {
          execSync('pnpm exec pm2 delete all', { stdio: 'inherit' });
          log.success('All services stopped');
        } catch {
          log.warning('No PM2 processes to stop');
        }
      }
    },
    {
      label: 'Format & lint code',
      action: async () => {
        log.info('Running formatters and linters...');
        try {
          execSync('pnpm format', { stdio: 'inherit' });
          execSync('pnpm lint:oxlint', { stdio: 'inherit' });
          log.success('Code formatted and linted!');
        } catch {
          log.error('Format/lint failed');
        }
      }
    },
    {
      label: 'Start local blockchain (Anvil)',
      action: async () => {
        log.info('Starting local blockchain...');
        await runCommand(packages.contracts, 'chain', packages.contracts.commands.chain);
      }
    },
    {
      label: 'Build all packages',
      action: async () => {
        log.info('Building all packages...');
        await runCommand(packages.all, 'build', packages.all.commands.build);
      }
    }
  ];
  
  const selection = await select('Quick Actions:', [
    ...actions.map((a, i) => ({ ...a, label: a.label })),
    { label: 'Back to main menu', value: 'back' }
  ]);
  
  if (selection.value !== 'back' && selection.action) {
    await selection.action();
    await question('\nPress Enter to continue...');
  }
}

async function mainMenu() {
  while (true) {
    console.clear();
    console.log(`
${colors.bright}${colors.green}🌱 Green Goods Project Assistant${colors.reset}
${colors.dim}════════════════════════════════${colors.reset}
    `);
    
    const options = [
      { label: 'Quick Actions', value: 'quick' },
      { label: 'All Packages (full environment)', value: 'all' },
      { label: 'Client (React PWA)', value: 'client' },
      { label: 'API Server', value: 'api' },
      { label: 'Blockchain Indexer', value: 'indexer' },
      { label: 'Smart Contracts', value: 'contracts' },
      { label: 'Setup Environment (.env)', value: 'env' },
      { label: 'Install/Update Dependencies', value: 'deps' },
      { label: 'Check Dependencies', value: 'check' },
      { label: 'Exit', value: 'exit' }
    ];
    
    const selection = await select('What would you like to work on?', options);
    
    switch (selection.value) {
      case 'quick':
        await quickActions();
        break;
      case 'env':
        await setupEnvironment();
        await question('\nPress Enter to continue...');
        break;
      case 'deps':
        await installDependencies();
        await question('\nPress Enter to continue...');
        break;
      case 'check':
        await checkDependencies();
        await question('\nPress Enter to continue...');
        break;
      case 'exit':
        log.success('Thanks for using Green Goods! 🌱');
        rl.close();
        process.exit(0);
      default:
        if (packages[selection.value]) {
          await packageMenu(packages[selection.value]);
        }
    }
  }
}

// Main entry point
async function main() {
  console.clear();
  console.log(`
${colors.bright}${colors.green}🌱 Welcome to Green Goods${colors.reset}
${colors.dim}A regenerative actions protocol${colors.reset}
  `);
  
  // Check dependencies first
  const missingDeps = await checkDependencies();
  
  // Check if this is first run (no node_modules)
  if (!fs.existsSync('node_modules')) {
    log.warning('No node_modules found. This appears to be a fresh clone.');
    await installDependencies();
  }
  
  // Check environment setup
  if (!fs.existsSync('.env')) {
    log.warning('No .env file found.');
    const setup = await question('Would you like to set up your environment now? (Y/n): ');
    if (setup.toLowerCase() !== 'n') {
      await setupEnvironment();
    }
  }
  
  // Show main menu
  await mainMenu();
}

// Handle exit gracefully
process.on('SIGINT', () => {
  console.log('\n');
  log.info('Interrupted. Exiting...');
  rl.close();
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('\n');
  log.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  rl.close();
  process.exit(1);
});
