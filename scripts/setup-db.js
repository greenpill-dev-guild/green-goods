#!/usr/bin/env node

const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkPostgreSQL() {
  try {
    await execAsync('which psql');
    log('✅ PostgreSQL is installed', 'green');
    return true;
  } catch {
    log('❌ PostgreSQL not found', 'red');
    return false;
  }
}

async function checkDocker() {
  try {
    await execAsync('docker --version');
    log('✅ Docker is installed', 'green');
    return true;
  } catch {
    log('❌ Docker not found', 'red');
    return false;
  }
}

async function startPostgreSQLDocker() {
  log('🐳 Starting PostgreSQL in Docker...', 'blue');
  
  try {
    // Check if container already exists
    const { stdout } = await execAsync('docker ps -a --format "{{.Names}}"');
    const containerExists = stdout.includes('greengoods-db');
    
    if (containerExists) {
      log('📦 Container exists, starting it...', 'yellow');
      await execAsync('docker start greengoods-db');
    } else {
      log('📦 Creating new PostgreSQL container...', 'blue');
      await execAsync(`docker run -d \
        --name greengoods-db \
        -e POSTGRES_PASSWORD=password \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_DB=greengoods_indexer \
        -p 5432:5432 \
        postgres:16`);
    }
    
    // Wait for PostgreSQL to be ready
    log('⏳ Waiting for PostgreSQL to be ready...', 'yellow');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        await execAsync('docker exec greengoods-db pg_isready -U postgres');
        log('✅ PostgreSQL is ready!', 'green');
        return true;
      } catch {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('PostgreSQL failed to start within timeout');
  } catch (error) {
    log(`❌ Failed to start PostgreSQL: ${error.message}`, 'red');
    return false;
  }
}

async function createDatabase() {
  try {
    // Try to create database (will fail if it already exists)
    await execAsync('docker exec greengoods-db createdb -U postgres greengoods_indexer');
    log('✅ Database created', 'green');
  } catch {
    log('ℹ️  Database already exists', 'yellow');
  }
}

async function main() {
  log('🔧 Setting up PostgreSQL for Green Goods Indexer', 'blue');
  log('=' .repeat(50), 'blue');
  
  const hasPostgreSQL = await checkPostgreSQL();
  const hasDocker = await checkDocker();
  
  if (!hasPostgreSQL && !hasDocker) {
    log('\n❌ Neither PostgreSQL nor Docker is installed', 'red');
    log('\nPlease install one of:', 'yellow');
    log('  • PostgreSQL: https://www.postgresql.org/download/', 'yellow');
    log('  • Docker: https://www.docker.com/get-started/', 'yellow');
    process.exit(1);
  }
  
  if (hasDocker) {
    const started = await startPostgreSQLDocker();
    if (started) {
      await createDatabase();
      log('\n✅ Database setup complete!', 'green');
      log('\nConnection details:', 'blue');
      log('  Host: localhost', 'blue');
      log('  Port: 5432', 'blue');
      log('  Database: greengoods_indexer', 'blue');
      log('  User: postgres', 'blue');
      log('  Password: password', 'blue');
    }
  } else {
    log('\n📝 Manual PostgreSQL setup required:', 'yellow');
    log('  createdb greengoods_indexer', 'yellow');
  }
}

if (require.main === module) {
  main().catch(err => {
    log(`\n❌ Setup failed: ${err.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { checkPostgreSQL, checkDocker, startPostgreSQLDocker }; 