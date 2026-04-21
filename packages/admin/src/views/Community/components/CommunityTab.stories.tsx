import {
  type Address,
  type GardenRole,
  PoolType,
  type RoleDirectoryEntry,
  type TabBadgeSeverity,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiMedalLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityTab } from "./CommunityTab";

const GARDEN_ID = "0x1234567890123456789012345678901234567890";
const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OPERATOR_A = "0x2222222222222222222222222222222222222222" as Address;
const OPERATOR_B = "0x3333333333333333333333333333333333333333" as Address;
const GARDENER_A = "0x5555555555555555555555555555555555555555" as Address;
const GARDENER_B = "0x6666666666666666666666666666666666666666" as Address;

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

const ALLOCATIONS = [
  {
    txHash: "0xtx1",
    timestamp: daysAgo(4),
    cookieJarAmount: 1_000_000_000_000_000_000n,
    fractionsAmount: 1_500_000_000_000_000_000n,
    juiceboxAmount: 1_500_000_000_000_000_000n,
  },
  {
    txHash: "0xtx2",
    timestamp: daysAgo(9),
    cookieJarAmount: 500_000_000_000_000_000n,
    fractionsAmount: 750_000_000_000_000_000n,
    juiceboxAmount: 750_000_000_000_000_000n,
  },
];

const meta: Meta<typeof CommunityTab> = {
  title: "Admin/Workflows/Garden/CommunityTab",
  component: CommunityTab,
  tags: ["autodocs"],
  decorators: [withRouter(["/garden/community"])],
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
