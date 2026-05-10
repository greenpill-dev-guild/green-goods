/**
 * Contracts Utilities
 *
 * Provides contract addresses, ABIs, and client creation utilities.
 * Re-exports from config and imports ABIs from @green-goods/contracts.
 */

import { type Abi, type Address, createPublicClient, http } from "viem";
import { getChain as getChainFromConfig } from "../../config/chains";
import type {
  MarketplaceContractAddresses,
  MarketplaceReadinessAvailable,
  MarketplaceReadinessField,
  MarketplaceReadinessState,
  NetworkContracts,
} from "../../types/contracts";
import { getNetworkName, getRpcUrl } from "./chain-registry";

// Re-export chain utilities from config
export { getChain } from "../../config/chains";

import ActionRegistryABIJson from "@green-goods/contracts/abis/ActionRegistry.json";
import GardenAccountABIJson from "@green-goods/contracts/abis/GardenAccount.json";
import GardenTokenABIJson from "@green-goods/contracts/abis/GardenToken.json";
import GreenGoodsENSABIJson from "@green-goods/contracts/abis/GreenGoodsENS.json";
import GreenWillABIJson from "@green-goods/contracts/abis/GreenWill.json";
import IHatsABIJson from "@green-goods/contracts/abis/IHats.json";
import EASABIJson from "@green-goods/contracts/abis/MockEAS.json";
// Import deployment configurations
import deployment42161 from "@green-goods/contracts/deployments/42161-latest.json";
import deployment42220 from "@green-goods/contracts/deployments/42220-latest.json";
import deployment11155111 from "@green-goods/contracts/deployments/11155111-latest.json";
import networksConfig from "@green-goods/contracts/deployments/networks.json";

// Export the ABIs for viem compatibility
export const GardenTokenABI = GardenTokenABIJson as Abi;
export const GardenAccountABI = GardenAccountABIJson as Abi;
export const ActionRegistryABI = ActionRegistryABIJson as Abi;
export const EASABI = EASABIJson as Abi;
export const GreenGoodsENSABI = GreenGoodsENSABIJson as Abi;
export const HatsABI = IHatsABIJson as Abi;
export const GreenWillABI = GreenWillABIJson as Abi;

// Re-export ERC20_ALLOWANCE_ABI from abis barrel for backward compatibility
export { ERC20_ALLOWANCE_ABI } from "./abis";

type DeploymentJsonValue =
  | string
  | number
  | boolean
  | null
  | DeploymentJsonValue[]
  | { [key: string]: DeploymentJsonValue };

/** Shape of deployment JSON files ({chainId}-latest.json) */
interface DeploymentConfig {
  [key: string]: DeploymentJsonValue | undefined;
}

/** Shape of networks.json — each network has contracts, rpc config, etc. */
interface NetworksConfig {
  networks: Record<string, { contracts?: Record<string, string>; [k: string]: unknown }>;
}

function getNetworkConfigFromNetworksJson(chainId: number) {
  const networksData = networksConfig as NetworksConfig;
  const networkName = getNetworkName(chainId);
  return networksData.networks[networkName] || networksData.networks.sepolia;
}

const DEPLOYMENT_CONFIGS: Record<string, DeploymentConfig> = {
  "42161": deployment42161 as DeploymentConfig,
  "42220": deployment42220 as DeploymentConfig,
  "11155111": deployment11155111 as DeploymentConfig,
};

import { isValidAddressFormat, isZeroAddress, ZERO_ADDRESS } from "./address";

export const MARKETPLACE_READINESS_REQUIRED_FIELDS = [
  "marketplaceAdapter",
  "hypercertsModule",
  "hypercertExchange",
  "hypercertMinter",
  "transferManager",
  "strategyHypercertFractionOffer",
] as const satisfies readonly MarketplaceReadinessField[];

function asAddress(value: unknown): Address {
  return typeof value === "string" ? (value as Address) : ZERO_ADDRESS;
}

function getDeploymentConfig(chainId: number | string): DeploymentConfig {
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
    cookieJarFactory: asAddress(deployment.cookieJarFactory),
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
    // GreenWill
    greenWill: asAddress(deployment.greenWill),
  };
}

function getMarketplaceContractAddresses(
  contracts: NetworkContracts
): MarketplaceContractAddresses {
  return {
    marketplaceAdapter: contracts.marketplaceAdapter,
    hypercertsModule: contracts.hypercertsModule,
    hypercertExchange: contracts.hypercertExchange,
    hypercertMinter: contracts.hypercertMinter,
    transferManager: contracts.transferManager,
    strategyHypercertFractionOffer: contracts.strategyHypercertFractionOffer,
  };
}

function isConfiguredAddress(address: Address | undefined): boolean {
  return isValidAddressFormat(address) && !isZeroAddress(address);
}

export function deriveMarketplaceReadiness(
  chainId: number,
  contracts: NetworkContracts
): MarketplaceReadinessState {
  const addresses = getMarketplaceContractAddresses(contracts);
  const missingFields = MARKETPLACE_READINESS_REQUIRED_FIELDS.filter(
    (field) => !isConfiguredAddress(addresses[field])
  );

  if (missingFields.length > 0) {
    return {
      status: "unavailable",
      available: false,
      chainId,
      addresses,
      missingFields,
      reason: `missing_required_marketplace_addresses:${missingFields.join(",")}`,
    };
  }

  return {
    status: "available",
    available: true,
    chainId,
    addresses,
    missingFields: [],
    reason: "all_required_addresses_configured",
  };
}

export function getMarketplaceReadiness(chainId: number): MarketplaceReadinessState {
  return deriveMarketplaceReadiness(chainId, getNetworkContracts(chainId));
}

export function formatMarketplaceReadinessError(readiness: MarketplaceReadinessState): string {
  if (readiness.available) {
    return "";
  }
  return `Marketplace configuration incomplete on chain ${readiness.chainId}: missing ${readiness.missingFields.join(", ")}`;
}

export function assertMarketplaceReady(chainId: number): MarketplaceReadinessAvailable {
  const readiness = getMarketplaceReadiness(chainId);
  if (!readiness.available) {
    throw new Error(formatMarketplaceReadinessError(readiness));
  }
  return readiness;
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
