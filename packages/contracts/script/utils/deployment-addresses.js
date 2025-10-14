const fs = require("node:fs");
const path = require("node:path");

class DeploymentAddresses {
  constructor(contractsDir = path.join(__dirname, "../../deployments")) {
    this.contractsDir = contractsDir;
  }

  loadForChain(chainId) {
    const chainMap = {
      localhost: "31337",
      arbitrum: "42161",
      baseSepolia: "84532",
      celo: "42220",
    };

    const normalizedChainId = chainMap[chainId] || chainId.toString();
    const deploymentFile = path.join(this.contractsDir, `${normalizedChainId}-latest.json`);

    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`No deployments found for chain ${chainId}. Please deploy contracts first.`);
    }

    const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    const requiredAddresses = ["actionRegistry", "gardenToken", "deploymentRegistry"];
    const missing = requiredAddresses.filter((addr) => !deploymentData[addr]);

    if (missing.length > 0) {
      throw new Error(`Missing contract addresses: ${missing.join(", ")}`);
    }

    return deploymentData;
  }

  getNetworkConfig(chainId) {
    const networksFile = path.join(this.contractsDir, "networks.json");
    const networks = JSON.parse(fs.readFileSync(networksFile, "utf8"));

    for (const [networkName, config] of Object.entries(networks.networks)) {
      if (networkName === chainId || config.chainId.toString() === chainId.toString()) {
        return { ...config, networkName };
      }
    }
    throw new Error(`Network configuration not found for chain ${chainId}`);
  }

  getCommunityToken(chainId) {
    const networkConfig = this.getNetworkConfig(chainId);
    if (!networkConfig.contracts?.communityToken) {
      throw new Error(`Community token not configured for chain ${chainId}`);
    }
    return networkConfig.contracts.communityToken;
  }
}

module.exports = { DeploymentAddresses };
