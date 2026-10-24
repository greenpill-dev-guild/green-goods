import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import type { QueryKey } from "@tanstack/react-query";
import type { RoleDirectoryEntry } from "@green-goods/shared/types/garden-detail";
import { PoolType, type YieldAllocation } from "@green-goods/shared/types/gardens-community";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { CommunityMembersTabProps } from "./CommunityMembersTab";

export const STORY_GARDEN_ID = "0x1234567890123456789012345678901234567890" as Address;
const STORY_OWNER = "0x1111111111111111111111111111111111111111" as Address;
const STORY_STEWARD = "0x2222222222222222222222222222222222222222" as Address;

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
  { role: "steward", count: 1, firstMember: STORY_STEWARD },
  { role: "evaluator", count: 0 },
  { role: "gardener", count: 0 },
  { role: "funder", count: 0 },
  { role: "community", count: 0 },
] as CommunityMembersTabProps["roleSummary"];

export const storyRoleMembers: Record<GardenRole, Address[]> = {
  owner: [STORY_OWNER],
  steward: [STORY_STEWARD],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

export const storyDirectory: RoleDirectoryEntry[] = [
  { address: STORY_OWNER, roles: ["owner"] },
  { address: STORY_STEWARD, roles: ["steward"] },
];

/**
 * A fuller garden for the people rows: a Green Goods name, ENS names, bare addresses and
 * profile photos, and people who hold several roles. `storyRosterIdentity` seeds each
 * person's name and photo lookups, so no story reads the network.
 */
const ROSTER_PEOPLE: {
  address: Address;
  roles: GardenRole[];
  protocolName?: string;
  ensName?: string;
  photo?: boolean;
}[] = [
  {
    address: "0x1111111111111111111111111111111111111111",
    roles: ["owner"],
    protocolName: "riolab.greengoods.eth",
    photo: true,
  },
  {
    address: "0x2222222222222222222222222222222222222222",
    roles: ["steward", "evaluator", "gardener"],
    ensName: "ana-souza.eth",
  },
  {
    address: "0x3333333333333333333333333333333333333333",
    roles: ["gardener"],
    protocolName: "chidinma.greengoods.eth",
    photo: true,
  },
  { address: "0x4444444444444444444444444444444444444444", roles: ["gardener"] },
  {
    address: "0x5555555555555555555555555555555555555555",
    roles: ["gardener", "funder"],
    ensName: "tomi.eth",
  },
  { address: "0x6666666666666666666666666666666666666666", roles: ["community"] },
];

export const storyRoster: RoleDirectoryEntry[] = ROSTER_PEOPLE.map(({ address, roles }) => ({
  address,
  roles,
}));

export const storyRosterRoleMembers = Object.fromEntries(
  (["owner", "steward", "evaluator", "gardener", "funder", "community"] as GardenRole[]).map(
    (role) => [
      role,
      ROSTER_PEOPLE.filter((person) => person.roles.includes(role)).map((p) => p.address),
    ]
  )
) as Record<GardenRole, Address[]>;

export const storyRosterRoleSummary = (
  Object.entries(storyRosterRoleMembers) as [GardenRole, Address[]][]
).map(([role, members]) => ({
  role,
  count: members.length,
  firstMember: members[0],
})) as CommunityMembersTabProps["roleSummary"];

/** Query cache seeds for each person's names and photo, keyed as the lookups read them. */
export function storyRosterIdentity(photo: string): (readonly [QueryKey, unknown])[] {
  return ROSTER_PEOPLE.flatMap((person) => [
    [queryKeys.ens.name(person.address), person.ensName ?? null] as const,
    [queryKeys.ens.protocolName(person.address), person.protocolName ?? null] as const,
    [queryKeys.ens.avatar(person.address), person.photo ? photo : null] as const,
    [queryKeys.profileAvatars.record(storyGarden.chainId, person.address), null] as const,
  ]);
}

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
