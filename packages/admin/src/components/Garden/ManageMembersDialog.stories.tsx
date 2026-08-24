import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ManageMembersDialog } from "./ManageMembersDialog";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OPERATOR_A = "0x2222222222222222222222222222222222222222" as Address;
const OPERATOR_B = "0x3333333333333333333333333333333333333333" as Address;
const GARDENER_A = "0x4444444444444444444444444444444444444444" as Address;
const GARDENER_B = "0x5555555555555555555555555555555555555555" as Address;

const roleMembers: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  operator: [OPERATOR_A, OPERATOR_B],
  evaluator: [],
  gardener: [GARDENER_A, GARDENER_B],
  funder: [],
  community: [],
};

const emptyRoleMembers: Record<GardenRole, Address[]> = {
  owner: [],
  operator: [],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

const meta: Meta<typeof ManageMembersDialog> = {
  title: "Admin/Workflows/Garden/ManageMembersDialog",
  component: ManageMembersDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The single membership surface — one flat roster across all roles with role filter chips, per-member remove, and the Add Members action. Community-owned: opens over /community/members.",
      },
    },
  },
  args: {
    open: true,
    onClose: fn(),
    roleMembers,
    canManage: true,
    isLoading: false,
    onRemoveMember: fn(),
    onAddMembers: fn(),
    tone: "community",
  },
};

export default meta;
type Story = StoryObj<typeof ManageMembersDialog>;

export const Default: Story = {};

export const ReadOnly: Story = {
  args: {
    canManage: false,
  },
};

export const Empty: Story = {
  args: {
    roleMembers: emptyRoleMembers,
  },
};

export const RemovalInFlight: Story = {
  args: {
    isLoading: true,
  },
};
