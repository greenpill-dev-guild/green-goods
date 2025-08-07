#!/usr/bin/env node

/**
 * Setup script to create root .env file for monorepo environment loading
 * Run with: node setup-env.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');
const ENV_PATH = path.join(ROOT_DIR, '.env');

console.log('🌍 Setting up environment for Green Goods monorepo...\n');

// Check if .env.example exists
if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
  console.error('❌ .env.example not found in root directory');
  console.log('Please make sure you\'re running this from the monorepo root.');
  process.exit(1);
}

// Check if .env already exists
if (fs.existsSync(ENV_PATH)) {
  console.log('✅ Root .env file already exists');
  console.log('If you want to reset it, delete .env and run this script again.\n');
} else {
  // Copy .env.example to .env
  try {
    const exampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    fs.writeFileSync(ENV_PATH, exampleContent);
    console.log('✅ Created .env file from .env.example\n');
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
    process.exit(1);
  }
}

// Check Vite config
const clientViteConfig = path.join(ROOT_DIR, 'packages/client/vite.config.ts');
if (fs.existsSync(clientViteConfig)) {
  console.log('✅ Client Vite config found');
  
  const viteContent = fs.readFileSync(clientViteConfig, 'utf8');
  if (viteContent.includes('envDir: rootDir')) {
    console.log('✅ Vite config updated for monorepo environment loading');
  } else {
    console.log('⚠️  Vite config may need updating for monorepo environment loading');
  }
} else {
  console.log('⚠️  Client Vite config not found');
}

console.log('\n📝 Next steps:');
console.log('1. Edit .env file with your actual values');
console.log('2. Run: pnpm dev (from root) or cd packages/client && pnpm dev');
console.log('3. Check browser console for environment variable debug info');
console.log('\n🔍 Environment file priority:');
console.log('  1. packages/client/.env.local (highest - local overrides)');
console.log('  2. packages/client/.env.development (mode-specific)');
console.log('  3. packages/client/.env (package-specific)');
console.log('  4. .env.local (root local overrides)');
console.log('  5. .env (root defaults - lowest)');
console.log('\n�� Happy coding!'); 