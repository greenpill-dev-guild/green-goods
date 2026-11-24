/**
 * Contracts Utilities
 *
 * Provides contract addresses, ABIs, and client creation utilities.
 * Re-exports from config and imports ABIs from @green-goods/contracts.
 */

import { type Abi, type Address, createPublicClient, getAddress, http } from "viem";
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
import ICommitmentPoolingModuleABIJson from "@green-goods/contracts/abis/ICommitmentPoolingModule.json";
import ICommitmentRegistryABIJson from "@green-goods/contracts/abis/ICommitmentRegistry.json";
import EASABIJson from "@green-goods/contracts/abis/MockEAS.json";
// Import deployment configurations
import deployment42161 from "@green-goods/contracts/deployments/42161-latest.json";
import rewardSafes42161 from "@green-goods/contracts/deployments/42161-reward-safes.json";
import deployment42220 from "@green-goods/contracts/deployments/42220-latest.json";
import deployment11155111 from "@green-goods/contracts/deployments/11155111-latest.json";
import networksConfig from "@green-goods/contracts/deployments/networks.json";

// Export the ABIs for viem compatibility. Every ABI declared here rides with the contract
// addresses in the chunk the installed app starts with, so an ABI only some screens use is a
// module of its own in `./contract-abis`, imported from there: GreenWill, Hats, the core module's
// service offers and the settlement module.
export const GardenTokenABI = GardenTokenABIJson as Abi;
export const GardenAccountABI = GardenAccountABIJson as Abi;
export const ActionRegistryABI = ActionRegistryABIJson as Abi;
export const EASABI = EASABIJson as Abi;
export const GreenGoodsENSABI = GreenGoodsENSABIJson as Abi;
export const CommitmentPoolingModuleABI = ICommitmentPoolingModuleABIJson as Abi;
export const CommitmentRegistryABI = ICommitmentRegistryABIJson as Abi;

// Re-export ERC20_ALLOWANCE_ABI from abis barrel for backward compatibility
export { ERC20_ALLOWANCE_ABI } from "./abis/erc20";

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
    commitmentPoolingModule: asAddress(deployment.commitmentPoolingModule),
    commitmentRegistry: asAddress(deployment.commitmentRegistry),
    settlementModule: asAddress(deployment.settlementModule),
    celoSettlementExecutor: asAddress(deployment.celoSettlementExecutor),
    rewardPayer: asAddress(deployment.rewardPayer),
  };
}

/**
 * The reward payer on a chain and the block it was deployed at, from which its
 * receipts are read (PRD-1556); null until it is deployed and verified there.
 */
export function getRewardPayerDeployment(
  chainId: number
): { address: Address; deployBlock: bigint } | null {
  const deployment = getDeploymentConfig(chainId);
  const address = asAddress(deployment.rewardPayer);
  const block = deployment.rewardPayerDeployBlock;
  if (isZeroAddress(address) || typeof block !== "number" || !Number.isSafeInteger(block)) {
    return null;
  }
  return { address, deployBlock: BigInt(block) };
}

/** Each chain's garden reward Safes, as `deployments/<chainId>-reward-safes.json` records them. */
const REWARD_SAFE_RECORDS: Readonly<Record<number, unknown>> = { 42161: rewardSafes42161 };
const rewardSafesByChain = new Map<number, ReadonlyMap<string, Address>>();

/**
 * The gardens a chain's record names, each with its Safe. An entry is left out when either address
 * is malformed, zero or not EIP-55 checksummed, when it names the garden as its own Safe, or when
 * its garden or Safe appears in another entry too: a record the app can't read exactly pays from
 * nowhere.
 */
function rewardSafesOf(chainId: number): ReadonlyMap<string, Address> {
  const cached = rewardSafesByChain.get(chainId);
  if (cached) return cached;
  const record = REWARD_SAFE_RECORDS[chainId] as
    | { schemaVersion?: unknown; chainId?: unknown; safes?: unknown }
    | undefined;
  const rows =
    record?.schemaVersion === 1 && record.chainId === chainId && Array.isArray(record.safes)
      ? (record.safes as unknown[])
      : [];
  // A row that isn't an object names nothing: it is skipped, and the other gardens still read.
  const entries = rows.map((row) =>
    row !== null && typeof row === "object" ? (row as { garden?: unknown; safe?: unknown }) : {}
  );
  // Every well-formed address counts towards a repeat, checksummed or not, so a mistyped copy of
  // a garden or Safe still takes both entries out rather than leaving one to be picked.
  const wellFormed = (value: unknown) =>
    typeof value === "string" && isConfiguredAddress(value as Address)
      ? (value.toLowerCase() as Address)
      : null;
  const checksummed = (value: unknown) => {
    try {
      return typeof value === "string" && getAddress(value) === value;
    } catch {
      return false;
    }
  };
  const pairs = entries.map((entry) => ({
    garden: wellFormed(entry.garden),
    safe: wellFormed(entry.safe),
    exact: checksummed(entry.garden) && checksummed(entry.safe),
  }));
  const count = new Map<string, number>();
  for (const { garden, safe } of pairs) {
    for (const address of [garden, safe]) {
      if (address) count.set(address, (count.get(address) ?? 0) + 1);
    }
  }
  const safes = new Map<string, Address>();
  for (const { garden, safe, exact } of pairs) {
    if (!garden || !safe || !exact || garden === safe) continue;
    if (count.get(garden) !== 1 || count.get(safe) !== 1) continue;
    safes.set(garden, getAddress(safe));
  }
  rewardSafesByChain.set(chainId, safes);
  return safes;
}

/**
 * The Safe a garden holds its reward USDC in and pays promise rewards from on a chain
 * (PRD-1556); null when the chain's record names none. A garden's own account never holds USDC,
 * so a garden without a recorded Safe has no USDC part to offer or pay.
 */
export function getGardenRewardSafe(
  chainId: number,
  garden: Address | null | undefined
): Address | null {
  if (!garden) return null;
  return rewardSafesOf(chainId).get(garden.toLowerCase()) ?? null;
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
