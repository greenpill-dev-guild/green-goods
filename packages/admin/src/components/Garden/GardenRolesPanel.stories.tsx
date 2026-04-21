import type { Address, GardenRole } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { GardenRolesPanel } from "./GardenRolesPanel";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OPERATOR_A = "0x2222222222222222222222222222222222222222" as Address;
const OPERATOR_B = "0x3333333333333333333333333333333333333333" as Address;
const EVAL_A = "0x4444444444444444444444444444444444444444" as Address;
const GARDENER_A = "0x5555555555555555555555555555555555555555" as Address;
const GARDENER_B = "0x6666666666666666666666666666666666666666" as Address;
const GARDENER_C = "0x7777777777777777777777777777777777777777" as Address;
const GARDENER_D = "0x8888888888888888888888888888888888888888" as Address;

const POPULATED: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  operator: [OPERATOR_A, OPERATOR_B],
  evaluator: [EVAL_A],
  gardener: [GARDENER_A, GARDENER_B, GARDENER_C, GARDENER_D],
  funder: [],
  community: [],
};

const EMPTY: Record<GardenRole, Address[]> = {
  owner: [],
  operator: [],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

const meta: Meta<typeof GardenRolesPanel> = {
  title: "Admin/Workflows/Garden/GardenRolesPanel",
  component: GardenRolesPanel,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Grid of role cards (owner / operator / evaluator / gardener / funder / community) with add and remove controls. Each card caps at 3 members visible with a 'view all' link.",
      },
    },
  },
  args: {
    onOpenAddMember: fn(),
    onOpenMembersModal: fn(),
    onRemoveMember: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof GardenRolesPanel>;

export const Populated: Story = {
  args: {
    roleMembers: POPULATED,
    canManageRoles: true,
    isLoading: false,
  },
};

export const Empty: Story = {
  args: {
    roleMembers: EMPTY,
    canManageRoles: true,
    isLoading: false,
  },
};

export const ReadOnly: Story = {
  args: {
    roleMembers: POPULATED,
    canManageRoles: false,
    isLoading: false,
  },
};

export const LoadingMutation: Story = {
  args: {
    roleMembers: POPULATED,
    canManageRoles: true,
    isLoading: true,
  },
};
