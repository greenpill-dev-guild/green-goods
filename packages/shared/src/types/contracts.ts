import type { Address } from "viem";
import type { WeightScheme } from "./gardens-community";

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
  cookieJarFactory: Address;
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
  // GreenWill
  greenWill: Address;
}

export type MarketplaceReadinessField =
  | "marketplaceAdapter"
  | "hypercertsModule"
  | "hypercertExchange"
  | "hypercertMinter"
  | "transferManager"
  | "strategyHypercertFractionOffer";

export type MarketplaceContractAddresses = Pick<NetworkContracts, MarketplaceReadinessField>;

export interface MarketplaceReadinessAvailable {
  status: "available";
  available: true;
  chainId: number;
  addresses: MarketplaceContractAddresses;
  missingFields: [];
  reason: "all_required_addresses_configured";
}

export interface MarketplaceReadinessUnavailable {
  status: "unavailable";
  available: false;
  chainId: number;
  addresses: Partial<MarketplaceContractAddresses>;
  missingFields: MarketplaceReadinessField[];
  reason: string;
}

export type MarketplaceReadinessState =
  | MarketplaceReadinessAvailable
  | MarketplaceReadinessUnavailable;

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
  gardeners: Address[];
  /** Addresses to grant Operator role atomically during mint */
  operators: Address[];
}

// Contract deployment parameters
export interface DeploymentParams {
  contractType: string;
  chainId: number;
  initParams?: unknown[];
}
