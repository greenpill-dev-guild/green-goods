import type { Address } from "../../types/domain";

export const worksKeys = {
  all: ["greengoods", "works"] as const,
  mine: (
    userAddress?: string,
    chainId?: number,
    includeOffline?: boolean,
    timeFilter?: string,
    limit?: number
  ) =>
    [
      "greengoods",
      "works",
      "mine",
      userAddress,
      chainId,
      includeOffline,
      timeFilter,
      limit,
    ] as const,
  online: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "online", gardenId, chainId] as const,
  offline: (gardenId: string) => ["greengoods", "works", "offline", gardenId] as const,
  merged: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "merged", gardenId, chainId] as const,
  approvals: (userAddress?: string, chainId?: number) =>
    ["greengoods", "works", "approvals", userAddress, chainId] as const,
} as const;

export const workApprovalsKeys = {
  all: ["greengoods", "workApprovals"] as const,
  byAttester: (attesterAddress?: string, chainId?: number) =>
    ["greengoods", "workApprovals", "byAttester", attesterAddress, chainId] as const,
  offline: (attesterAddress?: string) =>
    ["greengoods", "workApprovals", "offline", attesterAddress] as const,
} as const;

export const approvalsKeys = {
  all: ["greengoods", "approvals"] as const,
  byOperatorGardens: (gardenIds: string[]) =>
    [
      "greengoods",
      "approvals",
      "byOperatorGardens",
      JSON.stringify([...gardenIds].sort()),
    ] as const,
} as const;

export const operatorWorksKeys = {
  all: ["greengoods", "operatorWorks"] as const,
  byAddress: (address: Address | undefined, gardenIds: string[]) =>
    ["greengoods", "operatorWorks", address, JSON.stringify([...gardenIds].sort())] as const,
} as const;
