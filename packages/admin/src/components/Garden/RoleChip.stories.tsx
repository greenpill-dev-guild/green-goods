import { GARDEN_ROLE_ORDER } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { Meta, StoryObj } from "@storybook/react";
import { RoleChip } from "./RoleChip";

const meta: Meta<typeof RoleChip> = {
  title: "Admin/Workflows/Garden/RoleChip",
  component: RoleChip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A garden role in the membership dialogs: the role's colour pair around its singular name. Manage Members tags each roster row with it; Add Members tags each queued person with the role they are getting.",
      },
    },
  },
  args: {
    role: "gardener",
  },
};

export default meta;
type Story = StoryObj<typeof RoleChip>;

export const Default: Story = {};

export const AllRoles: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {GARDEN_ROLE_ORDER.map((role) => (
        <RoleChip key={role} role={role} />
      ))}
    </div>
  ),
};
