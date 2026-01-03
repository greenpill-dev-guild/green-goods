#!/usr/bin/env node

/**
 * Green Goods E2E Test Runner
 * 
 * Starts dev environment, runs Playwright tests, and cleans up
 * Usage:
 *   node scripts/test-e2e.js         # Run all tests
 *   node scripts/test-e2e.js smoke   # Run smoke tests only
 */

import { spawn, execSync } from 'child_process';
import https from 'https';
import fs from 'fs';

// Simple color helpers
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  dim: '\x1b[2m'
};

const log = {
  info: (msg) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}✓${c.reset}  ${msg}`),
  warning: (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error: (msg) => console.log(`${c.red}✗${c.reset}  ${msg}`),
  step: (msg) => console.log(`${c.blue}▶${c.reset}  ${msg}`)
};

// Track spawned processes for cleanup
let devProcess = null;

// Cleanup function
function cleanup() {
  log.info('Cleaning up...');
  
  if (devProcess) {
    try {
      devProcess.kill();
    } catch (err) {
      // Ignore
    }
  }
  
  // Clean up PM2 processes
  try {
    execSync('npx pm2 delete all', { stdio: 'ignore' });
  } catch (err) {
    // Ignore - PM2 might not be running
  }
  
  log.success('Cleanup complete');
}

// Register cleanup handlers
process.on('exit', cleanup);
process.on('SIGINT', () => {
  console.log('\n');
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

// Check if a service is responding
function checkService(url, timeout = 1000) {
  return new Promise((resolve) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => resolve(false));
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Wait for service to be ready
async function waitForService(name, url, maxRetries = 30) {
  log.step(`Waiting for ${name}...`);
  
  for (let i = 0; i < maxRetries; i++) {
    if (await checkService(url)) {
      log.success(`${name} is ready`);
      return true;
    }
    
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('');
  log.error(`${name} failed to start after ${maxRetries} seconds`);
  return false;
}

// Main function
async function main() {
  const testMode = process.argv[2] || 'all';
  
  console.log('');
  log.step('Starting E2E tests...');
  console.log('');
  
  // Start dev environment
  log.step('Starting dev environment...');
  const logFile = '/tmp/green-goods-dev.log';
  const logStream = fs.createWriteStream(logFile, { flags: 'w' });
  
  devProcess = spawn('bun', ['dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  // Pipe output to log file
  devProcess.stdout.pipe(logStream);
  devProcess.stderr.pipe(logStream);
  
  // Wait a bit for PM2 to initialize
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Wait for services to be ready
  const clientReady = await waitForService('Client', 'https://localhost:3001');
  if (!clientReady) {
    log.error('Client service failed to start. Check logs at: ' + logFile);
    process.exit(1);
  }
  
  console.log('');
  
  const adminReady = await waitForService('Admin', 'https://localhost:3002');
  if (!adminReady) {
    log.error('Admin service failed to start. Check logs at: ' + logFile);
    process.exit(1);
  }
  
  console.log('');
  log.step('Running Playwright tests...');
  console.log('');
  
  // Run tests
  const testArgs = testMode === 'smoke' 
    ? ['test', 'tests/specs/client.smoke.spec.ts', 'tests/specs/admin.smoke.spec.ts', '--project=chromium']
    : ['test'];
  
  try {
    execSync(`npx playwright ${testArgs.join(' ')}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        SKIP_WEBSERVER: 'true',
        SKIP_HEALTH_CHECK: 'true'
      }
    });
    
    console.log('');
    log.success('All tests passed!');
    process.exit(0);
  } catch (err) {
    console.log('');
    log.error(`Some tests failed (exit code: ${err.status || 1})`);
    process.exit(err.status || 1);
  }
}

// Run main function
main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
