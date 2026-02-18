// Contract addresses for different networks
export interface NetworkContracts {
  gardenToken: string;
  actionRegistry: string;
  workResolver: string;
  workApprovalResolver: string;
  deploymentRegistry: string;
  octantModule: string;
  hatsModule: string;
  karmaGAPModule: string;
  eas: string;
  easSchemaRegistry: string;
  communityToken: string;
  erc4337EntryPoint: string;
  multicallForwarder: string;
  cookieJarModule: string;
  yieldSplitter: string;
  gardensModule: string;
  greenGoodsENS: string;
  // Hypercert marketplace integration
  hypercertExchange: string;
  hypercertMinter: string;
  transferManager: string;
  marketplaceAdapter: string;
  hypercertsModule: string;
  strategyHypercertFractionOffer: string;
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
  /** Bitmask of ActionRegistry domains enabled for this garden (default: 0xFF = all) */
  domainMask: number;
}

// Contract deployment parameters
export interface DeploymentParams {
  contractType: string;
  chainId: number;
  initParams?: unknown[];
}
