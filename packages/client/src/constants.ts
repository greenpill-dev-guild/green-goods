export const APP_NAME = "Green Goods";
export const APP_DEFAULT_TITLE = "Green Goods";
export const APP_TITLE_TEMPLATE = "%s - Green Goods";
export const APP_DESCRIPTION = "Start Bringing Biodiversity Onchain";
export const APP_URL = "https://greengoods.app";
export const APP_ICON = "https://greengoods.app/icon.png";

// Import networks configuration
const networksConfig = require("../../contracts/deployments/networks.json");

// Helper function to get network config by chain ID
function getNetworkConfigFromNetworksJson(chainId: number) {
  const networks = networksConfig.networks;

  // Find network by chain ID
  for (const config of Object.values(networks)) {
    if ((config as any).chainId === chainId) {
      return config as any;
    }
  }

  // Fallback to Base Sepolia if not found
  return networks.baseSepolia;
}

// Function to safely import deployment files
function getDeploymentConfig(chainId: number | string) {
  const chain = String(chainId);
  try {
    switch (chain) {
      case "31337":
        return require("../../contracts/deployments/31337-latest.json");
      case "42161":
        return require("../../contracts/deployments/42161-latest.json");
      case "42220":
        return require("../../contracts/deployments/42220-latest.json");
      case "84532":
        return require("../../contracts/deployments/84532-latest.json");
      default:
        return {};
    }
  } catch (error) {
    return {};
  }
}

// EAS Configuration interface
interface EASConfig {
  GARDEN_ASSESSMENT: {
    uid: string;
    schema: string;
  };
  WORK: {
    uid: string;
    schema: string;
  };
  WORK_APPROVAL: {
    uid: string;
    schema: string;
  };
  EAS: {
    address: string;
  };
  SCHEMA_REGISTRY: {
    address: string;
  };
}

// Function to get EAS config for a specific chain
export function getEASConfig(chainId?: number | string): EASConfig {
  const chain = chainId ? Number(chainId) : 84532; // Default to Base Sepolia
  const deployment = getDeploymentConfig(chain);
  const networkConfig = getNetworkConfigFromNetworksJson(chain);

  return {
    GARDEN_ASSESSMENT: {
      uid:
        deployment.schemas?.gardenAssessmentSchemaUID ||
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      schema: deployment.schemas?.gardenAssessmentSchema || "",
    },
    WORK: {
      uid:
        deployment.schemas?.workSchemaUID ||
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      schema: deployment.schemas?.workSchema || "",
    },
    WORK_APPROVAL: {
      uid:
        deployment.schemas?.workApprovalSchemaUID ||
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      schema: deployment.schemas?.workApprovalSchema || "",
    },
    EAS: {
      address: deployment.eas?.address || networkConfig.contracts?.eas,
    },
    SCHEMA_REGISTRY: {
      address: deployment.eas?.schemaRegistry || networkConfig.contracts?.easSchemaRegistry,
    },
  };
}

// Network configuration interface
interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string | null;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts?: {
    [key: string]: string;
  };
}

// Function to build RPC URL with Alchemy key
function buildRpcUrl(rpcUrlTemplate: string, alchemyKey: string): string {
  // Handle different RPC URL patterns
  if (rpcUrlTemplate.includes("${BASE_SEPOLIA_RPC_URL}")) {
    return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  }
  if (rpcUrlTemplate.includes("${ARBITRUM_RPC_URL}")) {
    return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }
  if (rpcUrlTemplate.includes("${CELO_RPC_URL}")) {
    return `https://celo-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }
  if (rpcUrlTemplate.includes("${BASE_RPC_URL}")) {
    return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }
  if (rpcUrlTemplate.includes("${OPTIMISM_RPC_URL}")) {
    return `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }
  if (rpcUrlTemplate.includes("${SEPOLIA_RPC_URL}")) {
    return `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  }

  // Return as-is if no template variables (like localhost)
  return rpcUrlTemplate;
}

// Function to get network config for a specific chain
export function getNetworkConfig(chainId?: number | string): NetworkConfig {
  const chain = chainId ? Number(chainId) : 84532; // Default to Base Sepolia
  const networkConfig = getNetworkConfigFromNetworksJson(chain);
  const deployment = getDeploymentConfig(chain);
  const alchemyKey = import.meta.env.VITE_ALCHEMY_KEY || "demo";

  return {
    chainId: chain,
    name: networkConfig.name,
    rpcUrl: buildRpcUrl(networkConfig.rpcUrl, alchemyKey),
    blockExplorer: networkConfig.blockExplorer,
    nativeCurrency: networkConfig.nativeCurrency,
    contracts: {
      gardenToken: deployment.gardenToken || "0x0000000000000000000000000000000000000000",
      actionRegistry: deployment.actionRegistry || "0x0000000000000000000000000000000000000000",
      workResolver: deployment.workResolver || "0x0000000000000000000000000000000000000000",
      workApprovalResolver:
        deployment.workApprovalResolver || "0x0000000000000000000000000000000000000000",
      deploymentRegistry:
        deployment.deploymentRegistry || "0x0000000000000000000000000000000000000000",
      // Add contracts from networks.json
      eas: networkConfig.contracts?.eas || "0x0000000000000000000000000000000000000000",
      easSchemaRegistry:
        networkConfig.contracts?.easSchemaRegistry || "0x0000000000000000000000000000000000000000",
      communityToken:
        networkConfig.contracts?.communityToken || "0x0000000000000000000000000000000000000000",
      erc4337EntryPoint:
        networkConfig.contracts?.erc4337EntryPoint || "0x0000000000000000000000000000000000000000",
      multicallForwarder:
        networkConfig.contracts?.multicallForwarder || "0x0000000000000000000000000000000000000000",
    },
  };
}
