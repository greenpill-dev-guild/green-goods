import type { Address } from "../../types/domain";

export const greenWillKeys = {
  all: ["greengoods", "greenWill"] as const,
  definitions: (chainId: number) => ["greengoods", "greenWill", "definitions", chainId] as const,
  ownership: (owner: Address | string, chainId: number) =>
    ["greengoods", "greenWill", "ownership", owner, chainId] as const,
  recentGrants: (chainId: number, limit = 20) =>
    ["greengoods", "greenWill", "recentGrants", chainId, limit] as const,
} as const;
