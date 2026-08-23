import {
  type Address,
  type GardenRole,
  PoolType,
  type RoleDirectoryEntry,
  type YieldAllocation,
} from "@green-goods/shared";
import type { CommunityMembersTabProps } from "./CommunityMembersTab";

export const STORY_GARDEN_ID = "0x1234567890123456789012345678901234567890" as Address;
export const STORY_OWNER = "0x1111111111111111111111111111111111111111" as Address;
export const STORY_OPERATOR = "0x2222222222222222222222222222222222222222" as Address;

export const storyGarden = {
  id: STORY_GARDEN_ID,
  name: "Rio Rainforest Lab",
  chainId: 42161,
} as CommunityMembersTabProps["garden"];

export const storyPools = [
  {
    poolType: PoolType.Hypercert,
    poolAddress: "0x4444444444444444444444444444444444444444" as Address,
    gardenAddress: STORY_GARDEN_ID,
    communityAddress: STORY_GARDEN_ID,
  },
  {
    poolType: PoolType.Action,
    poolAddress: "0x6666666666666666666666666666666666666666" as Address,
    gardenAddress: STORY_GARDEN_ID,
    communityAddress: STORY_GARDEN_ID,
  },
];

export const storyRoleSummary = [
  { role: "owner", count: 1, firstMember: STORY_OWNER },
  { role: "operator", count: 1, firstMember: STORY_OPERATOR },
  { role: "evaluator", count: 0 },
  { role: "gardener", count: 0 },
  { role: "funder", count: 0 },
  { role: "community", count: 0 },
] as CommunityMembersTabProps["roleSummary"];

export const storyRoleMembers: Record<GardenRole, Address[]> = {
  owner: [STORY_OWNER],
  operator: [STORY_OPERATOR],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

export const storyDirectory: RoleDirectoryEntry[] = [
  { address: STORY_OWNER, roles: ["owner"] },
  { address: STORY_OPERATOR, roles: ["operator"] },
];

export const storyAllocations = [
  {
    gardenAddress: STORY_GARDEN_ID,
    assetAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address,
    txHash: "0xtx1",
    timestamp: 1_754_000_000,
    cookieJarAmount: 1_000_000_000_000_000_000n,
    fractionsAmount: 1_500_000_000_000_000_000n,
    juiceboxAmount: 1_500_000_000_000_000_000n,
    totalAmount: 4_000_000_000_000_000_000n,
  },
] satisfies YieldAllocation[];
