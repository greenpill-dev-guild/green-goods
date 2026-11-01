export const gardensKeys = {
  all: ["greengoods", "gardens"] as const,
  byChain: (chainId: number) => ["greengoods", "gardens", chainId] as const,
  detail: (gardenId: string, chainId: number) =>
    ["greengoods", "gardens", "detail", gardenId, chainId] as const,
  karmaStatus: (gardenId: string, chainId: number) =>
    ["greengoods", "gardens", "karma", "status", gardenId, chainId] as const,
  karmaVersion: (gardenId: string, chainId: number) =>
    ["greengoods", "gardens", "karma", "version", gardenId, chainId] as const,
  karmaSlug: (gardenId: string, chainId: number) =>
    ["greengoods", "gardens", "karma", "slug", gardenId, chainId] as const,
  /** The account's gardener cap, a chain read; under `all`, so a saved cap refetches it. */
  maxGardeners: (gardenId: string, chainId: number) =>
    ["greengoods", "gardens", "maxGardeners", gardenId, chainId] as const,
} as const;

/**
 * A batched action's wallet capability and unknown outcomes. Apart from each action's own keys,
 * because a save refreshes those and reading a hold can settle it. `domain` names the action and
 * its target, as the batch journal does.
 */
export const batchKeys = {
  /** Per connector: the same account can reconnect through a wallet that batches differently. */
  capability: (account: string, chainId: number, connectorId: string) =>
    ["greengoods", "batch", "capability", account, chainId, connectorId] as const,
  hold: (domain: string, account: string, chainId: number) =>
    ["greengoods", "batch", "hold", domain, account, chainId] as const,
  /** Spending this account has allowed, which decides how many signatures a deposit takes. */
  allowance: (asset: string, account: string, spender: string, chainId: number) =>
    ["greengoods", "batch", "allowance", asset, account, spender, chainId] as const,
  /** Sends in flight from this account, so a read of its holds waits for them. */
  depositSend: (account: string, chainId: number) =>
    ["greengoods", "batch", "deposit-send", account, chainId] as const,
  /** A deposit that came back past its ceilings, so the next press goes step by step. */
  overCeilings: (domain: string, account: string, chainId: number, amount: string) =>
    ["greengoods", "batch", "over-ceilings", domain, account, chainId, amount] as const,
} as const;

export const actionsKeys = {
  all: ["greengoods", "actions"] as const,
  byChain: (chainId: number) => ["greengoods", "actions", chainId] as const,
  detail: (chainId: number, actionUID: number) =>
    ["greengoods", "actions", chainId, "detail", actionUID] as const,
  byUIDs: (chainId: number, actionUIDs: readonly number[]) =>
    ["greengoods", "actions", chainId, "uids", actionUIDs] as const,
  atWork: (chainId: number, actionUID: number, workUID: string) =>
    ["greengoods", "actions", chainId, "atWork", actionUID, workUID] as const,
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
  /**
   * The detail an assessment stores on IPFS, by its config CID. Kept outside
   * `all`: the content can never change, so a new assessment must not refetch it.
   */
  detail: (configCid: string) => ["greengoods", "assessmentDetail", configCid] as const,
} as const;

export const platformKeys = {
  all: ["greengoods", "platform"] as const,
  stats: (chainId: number) => ["greengoods", "platform", "stats", chainId] as const,
} as const;
