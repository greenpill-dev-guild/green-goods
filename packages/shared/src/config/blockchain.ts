import deployment31337 from "@green-goods/contracts/deployments/31337-latest.json";
import deployment42161 from "@green-goods/contracts/deployments/42161-latest.json";
import deployment42220 from "@green-goods/contracts/deployments/42220-latest.json";
import deployment11155111 from "@green-goods/contracts/deployments/11155111-latest.json";
import networksConfig from "@green-goods/contracts/deployments/networks.json";

// Export types
export interface EASConfig {
  ASSESSMENT: { uid: string; schema: string };
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

// Internal type for deployment JSON structure
interface DeploymentConfig {
  schemas?: {
    assessmentSchemaUID?: string;
    assessmentSchema?: string;
    workSchemaUID?: string;
    workSchema?: string;
    workApprovalSchemaUID?: string;
    workApprovalSchema?: string;
  };
  eas?: {
    address?: string;
    schemaRegistry?: string;
  };
  gardenToken?: string;
  actionRegistry?: string;
  workResolver?: string;
  workApprovalResolver?: string;
  deploymentRegistry?: string;
  octantModule?: string;
  octantFactory?: string;
  hatsModule?: string;
  karmaGAPModule?: string;
  cookieJarModule?: string;
  goodsToken?: string;
  juiceboxProjectId?: number;
  rootGarden?: {
    address: string;
    tokenId: number;
  };
}

// Internal type for network JSON structure
interface NetworkJsonConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string | null;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  contracts?: Record<string, string>;
}

// Configuration maps for chain-specific data
const DEPLOYMENT_CONFIGS: Record<string, DeploymentConfig> = {
  "31337": deployment31337 as DeploymentConfig,
  "11155111": deployment11155111 as DeploymentConfig,
  "42161": deployment42161 as DeploymentConfig,
  "42220": deployment42220 as DeploymentConfig,
};

const EAS_GRAPHQL_URLS: Record<string, string> = {
  "42161": "https://arbitrum.easscan.org/graphql",
  "42220": "https://celo.easscan.org/graphql",
  "11155111": "https://sepolia.easscan.org/graphql",
};

const DEFAULT_EAS_GRAPHQL_URL = "https://sepolia.easscan.org/graphql";
const FALLBACK_CHAIN_ID = 11155111;

function hasNetworkConfig(chainId: number): boolean {
  return Object.values(networksConfig.networks).some(
    (config) => (config as NetworkJsonConfig).chainId === chainId
  );
}

function resolveChainId(chainId?: number | string): number {
  if (chainId === undefined || chainId === null || chainId === "") {
    return FALLBACK_CHAIN_ID;
  }
  const parsed = Number(chainId);
  if (!Number.isFinite(parsed)) {
    return FALLBACK_CHAIN_ID;
  }
  const hasDeployment = Boolean(DEPLOYMENT_CONFIGS[String(parsed)]);
  if (!hasDeployment || !hasNetworkConfig(parsed)) {
    return FALLBACK_CHAIN_ID;
  }
  return parsed;
}

// Helper function to get network config by chain ID
function getNetworkConfigFromNetworksJson(chainId: number): NetworkJsonConfig {
  const networks = networksConfig.networks;

  // Find network by chain ID
  for (const config of Object.values(networks)) {
    if ((config as NetworkJsonConfig).chainId === chainId) {
      return config as NetworkJsonConfig;
    }
  }

  // Fallback to Sepolia if not found
  return networks.sepolia as NetworkJsonConfig;
}

// Function to safely get deployment config using map lookup
function getDeploymentConfig(chainId: number | string): DeploymentConfig {
  const chain = String(chainId);
  return DEPLOYMENT_CONFIGS[chain] ?? {};
}

// Get EAS GraphQL URL based on chain using map lookup
export function getEasGraphqlUrl(chainId?: number | string): string {
  const chain = String(resolveChainId(chainId));
  return EAS_GRAPHQL_URLS[chain] ?? DEFAULT_EAS_GRAPHQL_URL;
}

// Function to get EAS config for a specific chain
export function getEASConfig(chainId?: number | string): EASConfig {
  const chain = resolveChainId(chainId);
  const deployment = getDeploymentConfig(chain);
  const networkConfig = getNetworkConfigFromNetworksJson(chain);

  return {
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
      address: deployment.eas?.address || networkConfig.contracts?.eas || "",
    },
    SCHEMA_REGISTRY: {
      address: deployment.eas?.schemaRegistry || networkConfig.contracts?.easSchemaRegistry || "",
    },
  };
}

// Function to build RPC URL with Alchemy key
function buildRpcUrl(rpcUrlTemplate: string, alchemyKey: string): string {
  // Handle different RPC URL patterns
  if (rpcUrlTemplate.includes("${ARBITRUM_RPC_URL}")) {
    return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }
  if (rpcUrlTemplate.includes("${CELO_RPC_URL}")) {
    return `https://celo-mainnet.g.alchemy.com/v2/${alchemyKey}`;
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
  const chain = resolveChainId(chainId);
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
      octantModule: deployment.octantModule || "0x0000000000000000000000000000000000000000",
      octantFactory: deployment.octantFactory || "0x0000000000000000000000000000000000000000",
      hatsModule: deployment.hatsModule || "0x0000000000000000000000000000000000000000",
      karmaGAPModule: deployment.karmaGAPModule || "0x0000000000000000000000000000000000000000",
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
export function getIndexerUrl(env: { VITE_ENVIO_INDEXER_URL?: string }, isDev: boolean): string {
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
export const DEFAULT_CHAIN_ID = resolveChainId((import.meta as any).env?.VITE_CHAIN_ID);

// Get default chain configuration
export function getDefaultChain() {
  const chainId = DEFAULT_CHAIN_ID;
  return getNetworkConfig(chainId);
}
