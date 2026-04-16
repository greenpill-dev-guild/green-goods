export const vaultsKeys = {
  all: ["greengoods", "vaults"] as const,
  byChain: (chainId: number) => ["greengoods", "vaults", "chain", chainId] as const,
  byGarden: (gardenAddress: string, chainId: number) =>
    ["greengoods", "vaults", "garden", gardenAddress, chainId] as const,
  deposits: (gardenAddress: string, chainId: number) =>
    ["greengoods", "vaults", "deposits", gardenAddress, chainId] as const,
  myDeposits: (gardenAddress: string, userAddress: string, chainId: number) =>
    ["greengoods", "vaults", "myDeposits", gardenAddress, userAddress, chainId] as const,
  myDepositsByUser: (userAddress: string, chainId: number) =>
    ["greengoods", "vaults", "myDepositsByUser", userAddress, chainId] as const,
  eventsBase: (gardenAddress: string, chainId: number) =>
    ["greengoods", "vaults", "events", gardenAddress, chainId] as const,
  events: (gardenAddress: string, chainId: number, limit?: number) =>
    ["greengoods", "vaults", "events", gardenAddress, chainId, limit] as const,
  preview: (
    vaultAddress: string,
    amount?: bigint,
    shares?: bigint,
    userAddress?: string,
    chainId?: number
  ) =>
    [
      "greengoods",
      "vaults",
      "preview",
      vaultAddress,
      amount?.toString(),
      shares?.toString(),
      userAddress,
      chainId,
    ] as const,
  allDeposits: (chainId: number) => ["greengoods", "vaults", "allDeposits", chainId] as const,
} as const;

export const cookieJarKeys = {
  all: ["greengoods", "cookieJar"] as const,
  byGarden: (gardenAddress: string, chainId: number) =>
    ["greengoods", "cookieJar", "garden", gardenAddress, chainId] as const,
  jarDetail: (jarAddress: string, chainId: number) =>
    ["greengoods", "cookieJar", "detail", jarAddress, chainId] as const,
  userHistory: (jarAddress: string, userAddress: string, chainId: number) =>
    ["greengoods", "cookieJar", "history", jarAddress, userAddress, chainId] as const,
} as const;

export const yieldKeys = {
  all: ["greengoods", "yield"] as const,
  /** Base key for garden allocations - use for prefix-based invalidation */
  allocationsBase: (gardenAddress: string, chainId: number) =>
    ["greengoods", "yield", "allocations", gardenAddress, chainId] as const,
  /** Full key with limit - use for specific queries */
  allocations: (gardenAddress: string, chainId: number, limit?: number) =>
    ["greengoods", "yield", "allocations", gardenAddress, chainId, limit] as const,
  byAsset: (assetAddress: string, chainId: number) =>
    ["greengoods", "yield", "byAsset", assetAddress, chainId] as const,
  splitConfig: (gardenAddress: string, chainId: number) =>
    ["greengoods", "yield", "splitConfig", gardenAddress, chainId] as const,
  pendingYield: (gardenAddress: string, assetAddress: string, chainId: number) =>
    ["greengoods", "yield", "pending", gardenAddress, assetAddress, chainId] as const,
  /** Per-garden yield summary (all allocations, aggregated client-side) */
  gardenSummary: (gardenAddress: string, chainId: number) =>
    ["greengoods", "yield", "gardenSummary", gardenAddress, chainId] as const,
  /** Protocol-wide yield summary (all gardens, all assets) */
  protocolSummary: (chainId: number) =>
    ["greengoods", "yield", "protocolSummary", chainId] as const,
} as const;
