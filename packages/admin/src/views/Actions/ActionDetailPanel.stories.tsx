import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { STORYBOOK_ADMIN_ACTIONS } from "../../../../shared/.storybook/adminFixtures";
import { withAdminPrimitiveFrame, withI18n } from "../../../../shared/.storybook/decorators";
import { ActionDetailPanel } from "./ActionDetailPanel";

const meta = {
  title: "Admin/Workspaces/Actions/ActionDetailPanel",
  component: ActionDetailPanel,
  tags: ["autodocs"],
  decorators: [withI18n, withAdminPrimitiveFrame],
  args: {
    actionId: STORYBOOK_ADMIN_ACTIONS[0]?.id,
    actions: STORYBOOK_ADMIN_ACTIONS,
    isLoading: false,
    canManageActions: true,
    onClose: fn(),
    onEdit: fn(),
  },
} satisfies Meta<typeof ActionDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const ReadOnly: Story = {
  args: { canManageActions: false },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const NotFound: Story = {
  args: { actionId: "missing-action" },
};
