/**
 * Contracts Utilities
 *
 * Provides contract addresses, ABIs, and client creation utilities.
 * Re-exports from config and imports ABIs directly from contracts/out.
 */

import { type Abi, type Address, createPublicClient, http } from "viem";
import type { NetworkContracts } from "../../types/contracts";
import { getChain as getChainFromConfig } from "../../config/chains";
import { getNetworkName, getRpcUrl } from "./chain-registry";

// Re-export chain utilities from config
export { getChain } from "../../config/chains";

// Import deployment configurations
import deployment42161 from "../../../../contracts/deployments/42161-latest.json";
import deployment42220 from "../../../../contracts/deployments/42220-latest.json";
import deployment11155111 from "../../../../contracts/deployments/11155111-latest.json";
import networksConfig from "../../../../contracts/deployments/networks.json";
import ActionRegistryABIJson from "../../../../contracts/out/Action.sol/ActionRegistry.json";
import EASABIJson from "../../../../contracts/out/EAS.sol/MockEAS.json";
import GardenAccountABIJson from "../../../../contracts/out/Garden.sol/GardenAccount.json";
// Import ABIs directly from contracts/out (single source of truth)
import GardenTokenABIJson from "../../../../contracts/out/Garden.sol/GardenToken.json";
import GreenGoodsENSABIJson from "../../../../contracts/out/ENS.sol/GreenGoodsENS.json";
import IHatsABIJson from "../../../../contracts/out/IHats.sol/IHats.json";

// Export the ABIs for viem compatibility
export const GardenTokenABI = GardenTokenABIJson.abi as Abi;
export const GardenAccountABI = GardenAccountABIJson.abi as Abi;
export const ActionRegistryABI = ActionRegistryABIJson.abi as Abi;
export const EASABI = EASABIJson.abi as Abi;
export const GreenGoodsENSABI = GreenGoodsENSABIJson.abi as Abi;
export const HatsABI = IHatsABIJson.abi as Abi;

function getNetworkConfigFromNetworksJson(chainId: number) {
  const networksData = networksConfig as { networks: Record<string, any> };
  const networkName = getNetworkName(chainId);
  return networksData.networks[networkName] || networksData.networks.sepolia;
}

const DEPLOYMENT_CONFIGS: Record<string, Record<string, any>> = {
  "42161": deployment42161 as Record<string, any>,
  "42220": deployment42220 as Record<string, any>,
  "11155111": deployment11155111 as Record<string, any>,
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function asAddress(value: unknown): Address {
  return typeof value === "string" ? (value as Address) : ZERO_ADDRESS;
}

function getDeploymentConfig(chainId: number | string): Record<string, any> {
  const chain = String(chainId);
  return DEPLOYMENT_CONFIGS[chain] ?? {};
}

export function getNetworkContracts(chainId: number): NetworkContracts {
  const deployment = getDeploymentConfig(chainId);
  const networkConfig = getNetworkConfigFromNetworksJson(chainId);

  return {
    gardenToken: asAddress(deployment.gardenToken),
    actionRegistry: asAddress(deployment.actionRegistry),
    workResolver: asAddress(deployment.workResolver),
    workApprovalResolver: asAddress(deployment.workApprovalResolver),
    deploymentRegistry: asAddress(deployment.deploymentRegistry),
    octantModule: asAddress(deployment.octantModule),
    hatsModule: asAddress(deployment.hatsModule),
    karmaGAPModule: asAddress(deployment.karmaGAPModule),
    eas: asAddress(networkConfig.contracts?.eas),
    easSchemaRegistry: asAddress(networkConfig.contracts?.easSchemaRegistry),
    communityToken: asAddress(networkConfig.contracts?.communityToken),
    erc4337EntryPoint: asAddress(networkConfig.contracts?.erc4337EntryPoint),
    multicallForwarder: asAddress(networkConfig.contracts?.multicallForwarder),
    cookieJarModule: asAddress(deployment.cookieJarModule),
    yieldSplitter: asAddress(deployment.yieldSplitter),
    gardensModule: asAddress(deployment.gardensModule),
    greenGoodsENS: asAddress(deployment.greenGoodsENS),
    // Hypercert marketplace integration
    hypercertExchange: asAddress(deployment.hypercertExchange),
    hypercertMinter: asAddress(deployment.hypercertMinter),
    transferManager: asAddress(deployment.transferManager),
    marketplaceAdapter: asAddress(deployment.marketplaceAdapter),
    hypercertsModule: asAddress(deployment.hypercertsModule),
    strategyHypercertFractionOffer: asAddress(deployment.strategyHypercertFractionOffer),
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
