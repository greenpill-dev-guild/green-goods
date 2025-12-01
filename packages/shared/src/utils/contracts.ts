/**
 * Contracts Utilities
 *
 * Provides contract addresses, ABIs, and client creation utilities.
 * Re-exports from config and imports ABIs directly from contracts/out.
 */

import { createPublicClient, http, type Abi } from "viem";
import { arbitrum, baseSepolia, celo } from "viem/chains";
import type { NetworkContracts } from "../types/contracts";

// Re-export chain utilities from config
export { getChain } from "../config/chains";

// Import deployment configurations
import deployment42161 from "../../../contracts/deployments/42161-latest.json";
import deployment42220 from "../../../contracts/deployments/42220-latest.json";
import deployment84532 from "../../../contracts/deployments/84532-latest.json";
import networksConfig from "../../../contracts/deployments/networks.json";

// Import ABIs directly from contracts/out (single source of truth)
import GardenTokenABIJson from "../../../contracts/out/Garden.sol/GardenToken.json";
import GardenAccountABIJson from "../../../contracts/out/Garden.sol/GardenAccount.json";
import ActionRegistryABIJson from "../../../contracts/out/Action.sol/ActionRegistry.json";
import EASABIJson from "../../../contracts/out/EAS.sol/MockEAS.json";

// Export the ABIs for viem compatibility
export const GardenTokenABI = GardenTokenABIJson.abi as Abi;
export const GardenAccountABI = GardenAccountABIJson.abi as Abi;
export const ActionRegistryABI = ActionRegistryABIJson.abi as Abi;
export const EASABI = EASABIJson.abi as Abi;

function getNetworkConfigFromNetworksJson(chainId: number) {
  const networksData = networksConfig as { networks: Record<string, any> };

  // Map chainId to network name
  let networkName = "";
  switch (chainId) {
    case 42161:
      networkName = "arbitrum";
      break;
    case 42220:
      networkName = "celo";
      break;
    case 84532:
      networkName = "baseSepolia";
      break;
    case 31337:
      networkName = "localhost";
      break;
    case 11155111:
      networkName = "sepolia";
      break;
    default:
      networkName = "baseSepolia";
  }

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
  const { getChain } = require("../config/chains");
  const chain = getChain(chainId);
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";

  let rpcUrl = "";
  switch (chainId) {
    case arbitrum.id:
      rpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
      break;
    case celo.id:
      rpcUrl = "https://forno.celo.org";
      break;
    case baseSepolia.id:
      rpcUrl = `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
      break;
    default:
      rpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  return { publicClient };
}
