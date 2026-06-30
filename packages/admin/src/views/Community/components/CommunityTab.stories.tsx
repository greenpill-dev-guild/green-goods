import {
  type Address,
  type GardenRole,
  PoolType,
  type RoleDirectoryEntry,
  type TabBadgeSeverity,
  type YieldAllocation,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiMedalLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityTab } from "./CommunityTab";

const GARDEN_ID = "0x1234567890123456789012345678901234567890";
const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OPERATOR_A = "0x2222222222222222222222222222222222222222" as Address;
const OPERATOR_B = "0x3333333333333333333333333333333333333333" as Address;
const GARDENER_A = "0x5555555555555555555555555555555555555555" as Address;
const GARDENER_B = "0x6666666666666666666666666666666666666666" as Address;
const TREASURY_ASSET = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address;

const roleIcons = {
  owner: RiShieldCheckLine,
  operator: RiUserLine,
  evaluator: RiCheckboxCircleLine,
  gardener: RiUserLine,
  funder: RiMedalLine,
  community: RiUserLine,
} as const satisfies Record<GardenRole, React.ComponentType<{ className?: string }>>;

const DIRECTORY: RoleDirectoryEntry[] = [
  { address: OWNER, roles: ["owner"] },
  { address: OPERATOR_A, roles: ["operator"] },
  { address: OPERATOR_B, roles: ["operator"] },
  { address: GARDENER_A, roles: ["gardener"] },
  { address: GARDENER_B, roles: ["gardener"] },
];

const ROLE_MEMBERS: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  operator: [OPERATOR_A, OPERATOR_B],
  evaluator: [],
  gardener: [GARDENER_A, GARDENER_B],
  funder: [],
  community: [OWNER, OPERATOR_A, GARDENER_A],
};

const ALLOCATIONS: YieldAllocation[] = [
  {
    gardenAddress: GARDEN_ID as Address,
    assetAddress: TREASURY_ASSET,
    txHash: "0xtx1",
    timestamp: daysAgo(4),
    cookieJarAmount: 1_000_000_000_000_000_000n,
    fractionsAmount: 1_500_000_000_000_000_000n,
    juiceboxAmount: 1_500_000_000_000_000_000n,
    totalAmount: 4_000_000_000_000_000_000n,
  },
  {
    gardenAddress: GARDEN_ID as Address,
    assetAddress: TREASURY_ASSET,
    txHash: "0xtx2",
    timestamp: daysAgo(9),
    cookieJarAmount: 500_000_000_000_000_000n,
    fractionsAmount: 750_000_000_000_000_000n,
    juiceboxAmount: 750_000_000_000_000_000n,
    totalAmount: 2_000_000_000_000_000_000n,
  },
];

const meta: Meta<typeof CommunityTab> = {
  title: "Admin/Workflows/Garden/CommunityTab",
  component: CommunityTab,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/garden/community"])],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Community tab of the garden detail route. Composes `GardenCommunityCard`, `GardenYieldCard`, the role-summary grid, and the member directory. All inputs are plain props so every section state is reviewable.",
      },
    },
  },
  args: {
    garden: { id: GARDEN_ID, name: "Rio Rainforest Lab" },
    gardenId: GARDEN_ID,
    canManage: true,
    isOwner: true,
    section: undefined,
    showSectionStateCard: true,
    clearSection: fn(),
    openSection: fn(),
    community: { weightScheme: 0 },
    communityLoading: false,
    pools: [
      { poolType: PoolType.Hypercert, poolAddress: "0xpoolhypercert" as Address },
      { poolType: PoolType.Action, poolAddress: "0xpoolaction" as Address },
    ],
    createPools: fn(),
    isCreatingPools: false,
    vaultsLoading: false,
    hasVaults: true,
    vaultNetDeposited: 12_000_000_000_000_000_000n,
    treasurySeverity: "none" as Exclude<TabBadgeSeverity, never>,
    allocations: ALLOCATIONS,
    allocationsLoading: false,
    roleSummary: [
      { role: "owner", count: 1, firstMember: OWNER },
      { role: "operator", count: 2, firstMember: OPERATOR_A },
      { role: "evaluator", count: 0 },
      { role: "gardener", count: 2, firstMember: GARDENER_A },
      { role: "funder", count: 0 },
      { role: "community", count: 3 },
    ],
    roleIcons,
    filteredDirectory: DIRECTORY,
    visibleDirectory: DIRECTORY.slice(0, 4),
    memberSearch: "",
    setMemberSearch: fn(),
    openMembersModal: fn(),
    roleMembers: ROLE_MEMBERS,
    scheduleBackgroundRefetch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CommunityTab>;

export const Populated: Story = {};

export const Loading: Story = {
  args: {
    communityLoading: true,
    vaultsLoading: true,
    allocationsLoading: true,
  },
};

export const MembersSection: Story = {
  args: {
    section: "members",
  },
};

export const NoPools: Story = {
  args: {
    pools: [],
  },
};

export const ReadOnly: Story = {
  args: {
    canManage: false,
    isOwner: false,
  },
};
