import type { AttestationFilters } from "../../types/hypercerts";
import { serializeAttestationFilters } from "./constants";

export const hypercertsKeys = {
  all: ["greengoods", "hypercerts"] as const,
  attestations: (gardenId?: string, filters?: AttestationFilters) =>
    [
      "greengoods",
      "hypercerts",
      "attestations",
      gardenId,
      serializeAttestationFilters(filters),
    ] as const,
  list: (gardenId?: string, chainId?: number, status?: string) =>
    ["greengoods", "hypercerts", "list", gardenId, chainId, status] as const,
  detail: (hypercertId?: string) => ["greengoods", "hypercerts", "detail", hypercertId] as const,
  drafts: (gardenId?: string, operatorAddress?: string) =>
    ["greengoods", "hypercerts", "drafts", gardenId, operatorAddress] as const,
} as const;

export const marketplaceKeys = {
  all: ["greengoods", "marketplace"] as const,
  orders: (gardenAddress: string, chainId: number) =>
    ["greengoods", "marketplace", "orders", gardenAddress, chainId] as const,
  activeOrder: (hypercertId: string, currency: string, chainId: number) =>
    ["greengoods", "marketplace", "active-order", hypercertId, currency, chainId] as const,
  sellerOrders: (seller: string, chainId: number) =>
    ["greengoods", "marketplace", "seller-orders", seller, chainId] as const,
  preview: (hypercertId: string, amount: string, currency: string, chainId: number) =>
    ["greengoods", "marketplace", "preview", hypercertId, amount, currency, chainId] as const,
  tradeHistory: (hypercertId: string, chainId: number) =>
    ["greengoods", "marketplace", "trades", hypercertId, chainId] as const,
  approvals: (operator: string, chainId: number) =>
    ["greengoods", "marketplace", "approvals", operator, chainId] as const,
} as const;

export const convictionKeys = {
  all: ["greengoods", "conviction"] as const,
  strategies: (gardenAddress: string, chainId: number) =>
    ["greengoods", "conviction", "strategies", gardenAddress, chainId] as const,
  registeredHypercerts: (poolAddress: string, chainId: number) =>
    ["greengoods", "conviction", "registeredHypercerts", poolAddress, chainId] as const,
  convictionWeights: (poolAddress: string, chainId: number) =>
    ["greengoods", "conviction", "convictionWeights", poolAddress, chainId] as const,
  memberPower: (poolAddress: string, voterAddress: string, chainId: number) =>
    ["greengoods", "conviction", "memberPower", poolAddress, voterAddress, chainId] as const,
} as const;
