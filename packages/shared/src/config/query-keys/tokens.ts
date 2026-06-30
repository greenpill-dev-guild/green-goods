/**
 * Query keys for the sendable-token surfaces (client PWA "Send" flow).
 *
 * Balances are read directly via RPC (not the indexer), so invalidation after a
 * send is a single delayed refetch rather than the indexer-lag schedule.
 */
export const tokensKeys = {
  all: ["greengoods", "tokens"] as const,
  /** Resolved GOODS token address for a chain (from `GardensModule.goodsToken()`). */
  goodsAddress: (chainId: number) => ["greengoods", "tokens", "goodsAddress", chainId] as const,
  /**
   * Sendable-token balances for one account on one chain. The caller lowercases
   * `account` so connected-wallet and card-wallet reads share a stable key.
   */
  balances: (account: string, chainId: number) =>
    ["greengoods", "tokens", "balances", account, chainId] as const,
} as const;
