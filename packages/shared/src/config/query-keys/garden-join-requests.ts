export const gardenJoinRequestKeys = {
  all: ["greengoods", "garden-join-requests"] as const,
  availability: () => ["greengoods", "garden-join-requests", "availability"] as const,
} as const;
