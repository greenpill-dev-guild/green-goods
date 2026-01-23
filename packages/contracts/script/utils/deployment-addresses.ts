import * as fs from "node:fs";
import * as path from "node:path";

export interface DeploymentData {
  actionRegistry: string;
  gardenToken: string;
  deploymentRegistry: string;
  gardenerAccountLogic: string;
  gardenAccountImpl?: string;
  accountProxy?: string;
  workResolver?: string;
  workApprovalResolver?: string;
  assessmentResolver?: string;
  [key: string]: string | undefined;
}

export interface NetworkContracts {
  communityToken?: string;
  [key: string]: string | undefined;
}

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  verifyApiUrl?: string;
  verifyApiKey?: string;
  contracts?: NetworkContracts;
  networkName?: string;
  name?: string;
}

export interface NetworksConfig {
  networks: Record<string, NetworkConfig>;
}

const CHAIN_MAP: Record<string, string> = {
  localhost: "31337",
  arbitrum: "42161",
  baseSepolia: "84532",
  celo: "42220",
};

export class DeploymentAddresses {
  private contractsDir: string;

  constructor(contractsDir = path.join(__dirname, "../../deployments")) {
    this.contractsDir = contractsDir;
  }

  loadForChain(chainId: string): DeploymentData {
    const normalizedChainId = CHAIN_MAP[chainId] || chainId.toString();
    const deploymentFile = path.join(this.contractsDir, `${normalizedChainId}-latest.json`);

    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`No deployments found for chain ${chainId}. Please deploy contracts first.`);
    }

    const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8")) as DeploymentData;
    const requiredAddresses = ["actionRegistry", "gardenToken", "deploymentRegistry", "gardenerAccountLogic"];
    const missing = requiredAddresses.filter((addr) => !deploymentData[addr]);

    if (missing.length > 0) {
      throw new Error(`Missing contract addresses: ${missing.join(", ")}`);
    }

    return deploymentData;
  }

  getNetworkConfig(chainId: string): NetworkConfig & { networkName: string } {
    const networksFile = path.join(this.contractsDir, "networks.json");
    const networks = JSON.parse(fs.readFileSync(networksFile, "utf8")) as NetworksConfig;

    for (const [networkName, config] of Object.entries(networks.networks)) {
      if (networkName === chainId || config.chainId.toString() === chainId.toString()) {
        return { ...config, networkName };
      }
    }
    throw new Error(`Network configuration not found for chain ${chainId}`);
  }

  getCommunityToken(chainId: string): string {
    const networkConfig = this.getNetworkConfig(chainId);
    if (!networkConfig.contracts?.communityToken) {
      throw new Error(`Community token not configured for chain ${chainId}`);
    }
    return networkConfig.contracts.communityToken;
  }
}
