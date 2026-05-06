export const gardensKeys = {
  all: ["greengoods", "gardens"] as const,
  byChain: (chainId: number) => ["greengoods", "gardens", chainId] as const,
  detail: (gardenId: string, chainId: number) =>
    ["greengoods", "gardens", "detail", gardenId, chainId] as const,
} as const;

export const actionsKeys = {
  all: ["greengoods", "actions"] as const,
  byChain: (chainId: number) => ["greengoods", "actions", chainId] as const,
} as const;

export const assessmentsKeys = {
  all: ["greengoods", "assessments"] as const,
  /** All assessments across gardens for a chain */
  byChain: (chainId: number) => ["greengoods", "assessments", "byChain", chainId] as const,
  /** Base key for garden assessments - use for prefix-based invalidation */
  byGardenBase: (gardenAddress: string, chainId: number) =>
    ["greengoods", "assessments", "byGarden", gardenAddress, chainId] as const,
  /** Full key with limit - use for specific queries */
  byGarden: (gardenAddress: string, chainId: number, limit?: number) =>
    ["greengoods", "assessments", "byGarden", gardenAddress, chainId, limit] as const,
} as const;

export const platformKeys = {
  all: ["greengoods", "platform"] as const,
  stats: (chainId: number) => ["greengoods", "platform", "stats", chainId] as const,
} as const;
