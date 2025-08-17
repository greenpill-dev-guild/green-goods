import type { Chain } from "viem";
import { arbitrum, baseSepolia, celo } from "viem/chains";

import deployment31337 from "../../contracts/deployments/31337-latest.json";
import deployment42161 from "../../contracts/deployments/42161-latest.json";
import deployment42220 from "../../contracts/deployments/42220-latest.json";
import deployment84532 from "../../contracts/deployments/84532-latest.json";
import networksConfig from "../../contracts/deployments/networks.json";

// Environment variables debug info (remove in production)
const debugEnvVars = () => {
  const viteVars = Object.keys(import.meta.env)
    .filter((key) => key.startsWith("VITE_"))
    .reduce(
      (acc, key) => {
        acc[key] = import.meta.env[key] ? "✅ Loaded" : "❌ Missing";
        return acc;
      },
      {} as Record<string, string>
    );

  void viteVars;
};

// Run debug in development
if (import.meta.env.DEV) {
  debugEnvVars();
}

// Supported chains configuration
export const SUPPORTED_CHAINS = {
  31337: "localhost",
  11155111: "sepolia",
  42161: "arbitrum",
  8453: "base",
  84532: "base-sepolia",
  10: "optimism",
  42220: "celo",
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

export const getChainName = (chainId: number): string => {
  return SUPPORTED_CHAINS[chainId as SupportedChainId] || "unknown";
};

export const isChainSupported = (chainId: number): chainId is SupportedChainId => {
  return chainId in SUPPORTED_CHAINS;
};

// Note: Avoid exporting a global CURRENT_CHAIN_ID. Prefer dynamic detection from wallet.

export const APP_NAME = "Green Goods";
export const APP_DEFAULT_TITLE = "Green Goods";
export const APP_TITLE_TEMPLATE = "%s - Green Goods";
export const APP_DESCRIPTION = "Start Bringing Biodiversity Onchain";
export const APP_URL = "https://greengoods.app";
export const APP_ICON = "https://greengoods.app/icon.png";

// Function to get the default chain based on environment variable
export function getDefaultChain(): Chain {
  const chainId = import.meta.env.VITE_CHAIN_ID;

  switch (chainId) {
    case "42161":
      return arbitrum;
    case "42220":
      return celo;
    case "84532":
      return baseSepolia;
    default:
      // Default to Base Sepolia if no environment variable is set
      return baseSepolia;
  }
}

// Constant chain id derived from env for app-wide use
export const DEFAULT_CHAIN_ID = getDefaultChain().id;

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
  } catch (error) {
    return {};
  }
}

// Dynamically determine indexer URL based on environment
export function getIndexerUrl() {
  // If explicitly set, use that
  if (import.meta.env.VITE_ENVIO_INDEXER_URL) {
    return import.meta.env.VITE_ENVIO_INDEXER_URL;
  }

  // Default to local development URL
  const isDev = import.meta.env.DEV;
  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isDev || isLocalhost) {
    return "http://localhost:8080/v1/graphql";
  }

  // Production URL (update when deployed)
  return "https://api.greengoods.app/indexer";
}

// Get EAS GraphQL URL based on chain
export function getEasGraphqlUrl(chainId?: number | string) {
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
