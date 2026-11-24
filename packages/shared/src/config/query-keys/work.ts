/** Some callers hold a garden from a ref that can still be empty at runtime. */
function gardenSegment(gardenId: string): string {
  return typeof gardenId === "string" ? gardenId.toLowerCase() : gardenId;
}

export const worksKeys = {
  all: ["greengoods", "works"] as const,
  visibility: (chainId: number) => ["greengoods", "works", "visibility", chainId] as const,
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
  mineByUser: (userAddress: string) => ["greengoods", "works", "mine", userAddress] as const,
  // Garden addresses arrive checksummed from the gardens list and lowercase from
  // indexed work rows; one spelling keeps a garden on one cached read.
  online: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "online", gardenSegment(gardenId), chainId] as const,
  window: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "window", gardenSegment(gardenId), chainId] as const,
  reviewQueue: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "reviewQueue", gardenSegment(gardenId), chainId] as const,
  /** The garden's works and decisions of the last week, for the bell (`readGardenActivity`). */
  activity: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "activity", gardenSegment(gardenId), chainId] as const,
  /** Every work the garden received between two moments, in seconds (`readGardenWorkRange`). */
  range: (gardenId: string, chainId: number, from: number, to: number) =>
    ["greengoods", "works", "range", gardenSegment(gardenId), chainId, from, to] as const,
  /** Review Health's weeks: a period read too, so a decision refreshes it with the others. */
  reviewFlow: (gardenId: string, chainId: number, from: number, to: number) =>
    ["greengoods", "works", "range", gardenSegment(gardenId), chainId, "flow", from, to] as const,
  /** Every period read of a garden (`range`), for refreshing them all after a decision. */
  ranges: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "range", gardenSegment(gardenId), chainId] as const,
  byUID: (uid: string, chainId: number) =>
    ["greengoods", "works", "byUID", uid.toLowerCase(), chainId] as const,
  offline: (gardenId: string, chainId?: number, account?: string) =>
    chainId === undefined && account === undefined
      ? (["greengoods", "works", "offline", gardenSegment(gardenId)] as const)
      : ([
          "greengoods",
          "works",
          "offline",
          gardenSegment(gardenId),
          chainId,
          account?.toLowerCase(),
        ] as const),
  local: (gardenId: string, chainId: number, account?: string) =>
    [
      "greengoods",
      "works",
      "local",
      gardenSegment(gardenId),
      chainId,
      account?.toLowerCase(),
    ] as const,
  metadata: (raw: string) => ["greengoods", "works", "metadata", raw] as const,
  merged: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "merged", gardenSegment(gardenId), chainId] as const,
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
  byMyWorkGardens: (userAddress: string | undefined, gardenIds: string[]) =>
    [
      "greengoods",
      "approvals",
      "byMyWorkGardens",
      userAddress,
      JSON.stringify([...gardenIds].sort()),
    ] as const,
} as const;
