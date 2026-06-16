import type { Address, GardenRole } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { GardenMembersPanel } from "./GardenMembersPanel";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OPERATOR_A = "0x2222222222222222222222222222222222222222" as Address;
const EVAL_A = "0x4444444444444444444444444444444444444444" as Address;
const GARDENER_A = "0x5555555555555555555555555555555555555555" as Address;
const GARDENER_B = "0x6666666666666666666666666666666666666666" as Address;
const GARDENER_C = "0x7777777777777777777777777777777777777777" as Address;

const GARDENERS = [OWNER, OPERATOR_A, EVAL_A, GARDENER_A, GARDENER_B, GARDENER_C];

const ROLE_MEMBERS: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  operator: [OPERATOR_A],
  evaluator: [EVAL_A],
  gardener: GARDENERS,
  funder: [],
  community: [],
};

const meta: Meta<typeof GardenMembersPanel> = {
  title: "Admin/Workflows/Garden/GardenMembersPanel",
  component: GardenMembersPanel,
  tags: ["autodocs"],
  decorators: [withAdminIdentity],
  parameters: {
    docs: {
      description: {
        component:
          "The `/garden/members` management surface: searchable roster (ENS or address) with role chips and copy actions, plus the existing member-write path — header Add member (gardener), Manage Roles (per-role add/remove via `GardenRolesPanel`), and per-role member lists. Writes flow through `useGardenOperations`, inert against the Storybook mock transport. Read-only viewers get the roster without management controls.",
      },
    },
  },
  args: {
    gardenAddress: "0x1234567890123456789012345678901234567890" as Address,
    gardenName: "Rio Rainforest Lab",
    gardeners: GARDENERS,
    operators: [OPERATOR_A],
    evaluators: [EVAL_A],
    funders: [],
    owners: [OWNER],
    roleMembers: ROLE_MEMBERS,
    canManage: true,
    onOpenAddMember: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof GardenMembersPanel>;

export const Populated: Story = {};

export const ReadOnly: Story = {
  args: { canManage: false },
};

export const Empty: Story = {
  args: {
    gardeners: [],
    operators: [],
    evaluators: [],
    owners: [],
    roleMembers: {
      owner: [],
      operator: [],
      evaluator: [],
      gardener: [],
      funder: [],
      community: [],
    },
  },
};
