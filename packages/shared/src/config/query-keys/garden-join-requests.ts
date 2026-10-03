export const gardenJoinRequestKeys = {
  all: ["greengoods", "garden-join-requests"] as const,
  availability: () => ["greengoods", "garden-join-requests", "availability"] as const,
  // Private session data: excluded from the persisted reading namespace and
  // removed by the existing Auth logout path (namespace !== "greengoods").
  self: (chainId: number, garden: string, account: string, authMode: string) =>
    [
      "garden-join-requests",
      "self",
      chainId,
      garden.toLowerCase(),
      account.toLowerCase(),
      authMode,
    ] as const,
} as const;
