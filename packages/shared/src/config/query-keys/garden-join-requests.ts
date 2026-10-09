import type { GardenJoinRequestKind } from "../../public-contracts/join-requests";

export const gardenJoinRequestKeys = {
  all: ["greengoods", "garden-join-requests"] as const,
  availability: () => ["greengoods", "garden-join-requests", "availability"] as const,
  // Private session data: excluded from the persisted reading namespace and
  // removed by the existing Auth logout path (namespace !== "greengoods").
  target: (chainId: number, account: string, kind: GardenJoinRequestKind, authMode = "none") =>
    ["garden-join-requests", "target", chainId, account.toLowerCase(), authMode, kind] as const,
  self: (
    chainId: number,
    garden: string,
    account: string,
    authMode: string,
    kind: GardenJoinRequestKind = "garden_membership"
  ) =>
    [
      "garden-join-requests",
      "self",
      chainId,
      garden.toLowerCase(),
      account.toLowerCase(),
      authMode,
      kind,
    ] as const,
} as const;
