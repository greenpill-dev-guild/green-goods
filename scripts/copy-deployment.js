#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function copyDeploymentFile() {
  const source = path.join(__dirname, '..', 'packages', 'contracts', 'deployments', 'local.json');
  const destination = path.join(__dirname, '..', 'packages', 'client', 'public', 'contracts', 'deployments');
  const destFile = path.join(destination, 'local.json');
  
  try {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
      console.log('✅ Created directory:', destination);
    }
    
    // Check if source file exists
    if (fs.existsSync(source)) {
      // Copy the file
      fs.copyFileSync(source, destFile);
      console.log('✅ Copied deployment file to client public directory');
      console.log(`   From: ${source}`);
      console.log(`   To: ${destFile}`);
      
      // Read and display contract addresses
      const deployment = JSON.parse(fs.readFileSync(source, 'utf8'));
      console.log('\n📋 Deployed Contracts:');
      Object.entries(deployment.contracts).forEach(([name, address]) => {
        console.log(`   ${name}: ${address}`);
      });
      
    } else {
      console.warn('⚠️  No deployment file found at:', source);
      console.log('   Run the deployment script first: pnpm --filter contracts deploy:local');
    }
  } catch (error) {
    console.error('❌ Error copying deployment file:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  copyDeploymentFile();
}

module.exports = { copyDeploymentFile }; 