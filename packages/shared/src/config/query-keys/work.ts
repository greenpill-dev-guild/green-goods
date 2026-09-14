import type { Address } from "../../types/domain";

/** Some callers hold a garden from a ref that can still be empty at runtime. */
function gardenSegment(gardenId: string): string {
  return typeof gardenId === "string" ? gardenId.toLowerCase() : gardenId;
}

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
  mineByUser: (userAddress: string) => ["greengoods", "works", "mine", userAddress] as const,
  // Garden addresses arrive checksummed from the gardens list and lowercase from
  // indexed work rows; one spelling keeps a garden on one cached read.
  online: (gardenId: string, chainId: number) =>
    ["greengoods", "works", "online", gardenSegment(gardenId), chainId] as const,
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
  // Recipients = gardens ∪ candidate works' gardeners (see utils/work/pending-review.ts);
  // lowercased for key stability across checksum casings.
  forWorkReview: (recipients: string[]) =>
    [
      "greengoods",
      "approvals",
      "forWorkReview",
      JSON.stringify(recipients.map((recipient) => recipient.toLowerCase()).sort()),
    ] as const,
  byMyWorkGardens: (userAddress: string | undefined, gardenIds: string[]) =>
    [
      "greengoods",
      "approvals",
      "byMyWorkGardens",
      userAddress,
      JSON.stringify([...gardenIds].sort()),
    ] as const,
} as const;

export const stewardWorksKeys = {
  all: ["greengoods", "stewardWorks"] as const,
  // "v2": queryFn shape changed from Work[] to { works, failedGardenIds }. The persisted-cache
  // buster only rotates per release (VITE_APP_VERSION), so a same-version cache could hydrate
  // the old array shape under the old key — a new key makes old entries miss instead of mis-parse.
  byAddress: (address: Address | undefined, gardenIds: string[]) =>
    ["greengoods", "stewardWorks", "v2", address, JSON.stringify([...gardenIds].sort())] as const,
} as const;
