import { QueryClient } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arbitrum, baseSepolia, celo } from "wagmi/chains";
import { arbitrum as arbitrumNetwork } from "@reown/appkit/networks";

import deployment42161 from "../../contracts/deployments/42161-latest.json";
import deployment42220 from "../../contracts/deployments/42220-latest.json";
import deployment84532 from "../../contracts/deployments/84532-latest.json";
import networksConfig from "../../contracts/deployments/networks.json";

export const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID) || arbitrum.id;

export const APP_TITLE = "Green Goods";
export const APP_DESCRIPTION = "Garden management dashboard for Green Goods protocol";

export const SUPPORTED_CHAINS = [arbitrum, celo, baseSepolia];

export function getDefaultChain() {
  return SUPPORTED_CHAINS.find((chain) => chain.id === DEFAULT_CHAIN_ID) || arbitrum;
}

// Use proxy in development, direct URL in production
export const INDEXER_URL = import.meta.env.DEV
  ? "/api/graphql"
  : import.meta.env.VITE_ENVIO_INDEXER_URL ||
    "https://indexer.dev.hyperindex.xyz/2e23bea/v1/graphql";

function getNetworkConfigFromNetworksJson(chainId: number) {
  const networks = networksConfig.networks as Record<string, any>;
  const entry = Object.values(networks).find((config: any) => config.chainId === chainId);
  return (entry as any) || (networks.baseSepolia as any);
}

function getDeploymentConfig(chainId: number | string): Record<string, any> {
  const chain = String(chainId);
  try {
    switch (chain) {
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

export function getEASConfig(chainId?: number | string): EASConfig {
  const chain = chainId ? Number(chainId) : 84532;
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

// 1. Get projectId from https://cloud.reown.com
export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id";

// 2. Create a metadata object - optional
export const metadata = {
  name: "Green Goods Admin",
  description: "Garden management dashboard for Green Goods protocol",
  url: typeof window !== "undefined" ? window.location.origin : "https://green-goods.app",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// 3. Set the networks - ensure we have at least one
export const networks = [arbitrum, celo, baseSepolia];

// 4. Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
});

// 5. Export wagmi config
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// 6. Create and export query client
export const queryClient = new QueryClient();

// Initialize AppKit *outside* the component render cycle
// Add a check for projectId for type safety
if (!projectId) {
  console.error("AppKit Initialization Error: Project ID is missing.");
} else {
  createAppKit({
    adapters: [wagmiAdapter],
    // Use non-null assertion `!` as projectId is checked runtime, needed for TypeScript
    projectId: projectId!,
    // Pass networks directly (type is now correctly inferred from config)
    networks: [arbitrum, celo, baseSepolia],
    defaultNetwork: arbitrumNetwork, // Use arbitrum as default
    metadata,
    features: {
      analytics: false, // Disable analytics for privacy
      email: false, // Disable email login
      socials: [], // No social logins
      emailShowWallets: true,
    },
  });
}

console.log("INDEXER_URL", INDEXER_URL);
