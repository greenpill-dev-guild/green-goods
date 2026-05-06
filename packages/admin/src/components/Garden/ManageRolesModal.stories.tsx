import type { Address, GardenRole } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ManageRolesModal } from "./ManageRolesModal";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OPERATOR_A = "0x2222222222222222222222222222222222222222" as Address;
const OPERATOR_B = "0x3333333333333333333333333333333333333333" as Address;

const roleMembers: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  operator: [OPERATOR_A, OPERATOR_B],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

const meta: Meta<typeof ManageRolesModal> = {
  title: "Admin/Workflows/Garden/ManageRolesModal",
  component: ManageRolesModal,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "DialogShell wrapper that hosts the full GardenRolesPanel grid. Opens from the garden profile/settings flow.",
      },
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    roleMembers,
    canManageRoles: true,
    isLoading: false,
    onOpenAddMember: fn(),
    onOpenMembersModal: fn(),
    onRemoveMember: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ManageRolesModal>;

export const Default: Story = {};

export const ReadOnly: Story = {
  args: {
    canManageRoles: false,
  },
};
