import deployment31337 from "../../../contracts/deployments/31337-latest.json";
import deployment42161 from "../../../contracts/deployments/42161-latest.json";
import deployment42220 from "../../../contracts/deployments/42220-latest.json";
import deployment84532 from "../../../contracts/deployments/84532-latest.json";
import networksConfig from "../../../contracts/deployments/networks.json";

// Export types
export interface EASConfig {
  GARDEN_ASSESSMENT: { uid: string; schema: string };
  ASSESSMENT?: { uid: string; schema: string };
  WORK: { uid: string; schema: string };
  WORK_APPROVAL: { uid: string; schema: string };
  EAS: { address: string };
  SCHEMA_REGISTRY: { address: string };
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string | null;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  contracts: Record<string, string>;
  rootGarden?: { address: `0x${string}`; tokenId: number };
}

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
function getDeploymentConfig(chainId: number | string): any {
  const chain = String(chainId);
  try {
    switch (chain) {
      case "31337":
        return deployment31337;
      case "42161":
        return deployment42161;
      case "42220":
        return deployment42220;
      case "84532":
        return deployment84532;
      default:
        return {};
    }
  } catch {
    return {};
  }
}

// Get EAS GraphQL URL based on chain
export function getEasGraphqlUrl(chainId?: number | string): string {
  const chain = String(chainId ?? 84532);

  switch (chain) {
    case "42161":
      return "https://arbitrum.easscan.org/graphql";
    case "42220":
      return "https://celo.easscan.org/graphql";
    case "84532":
      return "https://base-sepolia.easscan.org/graphql";
    default:
      return "https://base-sepolia.easscan.org/graphql";
  }
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
    ASSESSMENT: {
      uid:
        deployment.schemas?.assessmentSchemaUID ||
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      schema: deployment.schemas?.assessmentSchema || "",
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
export function getNetworkConfig(chainId?: number | string, alchemyKey = "demo"): NetworkConfig {
  const chain = chainId ? Number(chainId) : 84532; // Default to Base Sepolia
  const networkConfig = getNetworkConfigFromNetworksJson(chain);
  const deployment = getDeploymentConfig(chain);

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
    rootGarden: deployment.rootGarden
      ? {
          address: deployment.rootGarden.address as `0x${string}`,
          tokenId: deployment.rootGarden.tokenId,
        }
      : undefined,
  };
}

// Dynamically determine indexer URL based on environment
export function getIndexerUrl(env: any, isDev: boolean): string {
  // If explicitly set, use that
  if (env.VITE_ENVIO_INDEXER_URL) {
    return env.VITE_ENVIO_INDEXER_URL;
  }

  if (isDev) {
    return "http://localhost:8080/v1/graphql";
  }

  // Production URL (update when deployed)
  return "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
}

// Default chain ID from environment variable
export const DEFAULT_CHAIN_ID = Number((import.meta as any).env?.VITE_CHAIN_ID) || 84532;

// Get default chain configuration
export function getDefaultChain() {
  const chainId = DEFAULT_CHAIN_ID;
  return getNetworkConfig(chainId);
}
