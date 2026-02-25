import type { Address } from "viem";

// Contract addresses for different networks
export interface NetworkContracts {
  gardenToken: Address;
  actionRegistry: Address;
  workResolver: Address;
  workApprovalResolver: Address;
  deploymentRegistry: Address;
  octantModule: Address;
  hatsModule: Address;
  karmaGAPModule: Address;
  eas: Address;
  easSchemaRegistry: Address;
  communityToken: Address;
  erc4337EntryPoint: Address;
  multicallForwarder: Address;
  cookieJarModule: Address;
  yieldSplitter: Address;
  gardensModule: Address;
  greenGoodsENS: Address;
  // Hypercert marketplace integration
  hypercertExchange: Address;
  hypercertMinter: Address;
  transferManager: Address;
  marketplaceAdapter: Address;
  hypercertsModule: Address;
  strategyHypercertFractionOffer: Address;
}

/**
 * Weight scheme for Gardens V2 conviction voting signal pools.
 * Must match `IGardensModule.WeightScheme` enum in Solidity.
 */
export enum WeightScheme {
  Linear = 0,
  Exponential = 1,
  Power = 2,
}

// Garden creation parameters — must match GardenToken.GardenConfig struct
export interface CreateGardenParams {
  name: string;
  slug: string;
  description: string;
  location: string;
  bannerImage: string;
  metadata: string;
  openJoining: boolean;
  /** Conviction voting weight scheme (default: Linear) */
  weightScheme: WeightScheme;
  /** Bitmask of ActionRegistry domains enabled for this garden (0x0F = all 4 domains) */
  domainMask: number;
  /** Addresses to grant Gardener role atomically during mint */
  gardeners: `0x${string}`[];
  /** Addresses to grant Operator role atomically during mint */
  operators: `0x${string}`[];
}

// Contract deployment parameters
export interface DeploymentParams {
  contractType: string;
  chainId: number;
  initParams?: unknown[];
}
