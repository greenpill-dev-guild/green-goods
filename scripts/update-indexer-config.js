#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function updateIndexerConfig() {
  const deploymentPath = path.join(__dirname, '..', 'packages', 'contracts', 'deployments', 'local.json');
  const configPath = path.join(__dirname, '..', 'packages', 'indexer', 'config.local.yaml');
  
  try {
    // Check if deployment file exists
    if (!fs.existsSync(deploymentPath)) {
      console.warn('⚠️  No deployment file found. Run deployment first.');
      return false;
    }
    
    // Read deployment data
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    // Read current config
    const configContent = fs.readFileSync(configPath, 'utf8');
    let config = yaml.load(configContent);
    
    // Update contract addresses
    if (config.networks && config.networks[0]) {
      const network = config.networks[0];
      
      // Map deployment names to config names
      const addressMapping = {
        'ActionRegistry': deployment.contracts.actionRegistry,
        'GardenToken': deployment.contracts.gardenToken,
        'GardenAccount': deployment.contracts.gardenAccount || deployment.contracts.gardenOperators,
        'EAS': deployment.contracts.eas
      };
      
      // Update each contract address
      network.contracts.forEach(contract => {
        if (addressMapping[contract.name]) {
          contract.address = addressMapping[contract.name];
          console.log(`✅ Updated ${contract.name}: ${contract.address}`);
        }
      });
      
      // Write updated config
      const updatedYaml = yaml.dump(config, { lineWidth: 120 });
      fs.writeFileSync(configPath, updatedYaml);
      
      console.log('\n✅ Indexer config updated with deployment addresses');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Error updating indexer config:', error.message);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  updateIndexerConfig();
}

module.exports = { updateIndexerConfig }; 