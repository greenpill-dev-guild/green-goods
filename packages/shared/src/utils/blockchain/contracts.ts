/**
 * Contracts Utilities
 *
 * Provides contract addresses, ABIs, and client creation utilities.
 * Re-exports from config and imports ABIs directly from contracts/out.
 */

import { type Abi, createPublicClient, http } from "viem";
import type { NetworkContracts } from "../../types/contracts";
import { getChain as getChainFromConfig } from "../../config/chains";
import { getNetworkName, getRpcUrl } from "./chain-registry";

// Re-export chain utilities from config
export { getChain } from "../../config/chains";

// Import deployment configurations
import deployment42161 from "../../../../contracts/deployments/42161-latest.json";
import deployment42220 from "../../../../contracts/deployments/42220-latest.json";
import deployment84532 from "../../../../contracts/deployments/84532-latest.json";
import networksConfig from "../../../../contracts/deployments/networks.json";
import ActionRegistryABIJson from "../../../../contracts/out/Action.sol/ActionRegistry.json";
import EASABIJson from "../../../../contracts/out/EAS.sol/MockEAS.json";
import GardenAccountABIJson from "../../../../contracts/out/Garden.sol/GardenAccount.json";
// Import ABIs directly from contracts/out (single source of truth)
import GardenTokenABIJson from "../../../../contracts/out/Garden.sol/GardenToken.json";

// Export the ABIs for viem compatibility
export const GardenTokenABI = GardenTokenABIJson.abi as Abi;
export const GardenAccountABI = GardenAccountABIJson.abi as Abi;
export const ActionRegistryABI = ActionRegistryABIJson.abi as Abi;
export const EASABI = EASABIJson.abi as Abi;

function getNetworkConfigFromNetworksJson(chainId: number) {
  const networksData = networksConfig as { networks: Record<string, any> };
  const networkName = getNetworkName(chainId);
  return networksData.networks[networkName] || networksData.networks.baseSepolia;
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

export function getNetworkContracts(chainId: number): NetworkContracts {
  const deployment = getDeploymentConfig(chainId);
  const networkConfig = getNetworkConfigFromNetworksJson(chainId);

  return {
    gardenToken: deployment.gardenToken || "0x0000000000000000000000000000000000000000",
    actionRegistry: deployment.actionRegistry || "0x0000000000000000000000000000000000000000",
    workResolver: deployment.workResolver || "0x0000000000000000000000000000000000000000",
    workApprovalResolver:
      deployment.workApprovalResolver || "0x0000000000000000000000000000000000000000",
    deploymentRegistry:
      deployment.deploymentRegistry || "0x0000000000000000000000000000000000000000",
    eas: networkConfig.contracts?.eas || "0x0000000000000000000000000000000000000000",
    easSchemaRegistry:
      networkConfig.contracts?.easSchemaRegistry || "0x0000000000000000000000000000000000000000",
    communityToken:
      networkConfig.contracts?.communityToken || "0x0000000000000000000000000000000000000000",
    erc4337EntryPoint:
      networkConfig.contracts?.erc4337EntryPoint || "0x0000000000000000000000000000000000000000",
    multicallForwarder:
      networkConfig.contracts?.multicallForwarder || "0x0000000000000000000000000000000000000000",
  };
}

export function createClients(chainId: number) {
  const chain = getChainFromConfig(chainId);
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
  const rpcUrl = getRpcUrl(chainId, alchemyKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  return { publicClient };
}
