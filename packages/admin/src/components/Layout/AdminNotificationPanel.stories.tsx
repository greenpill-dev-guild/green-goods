import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withAdminPrimitiveFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { AdminNotificationPanel } from "./AdminNotificationPanel";

const meta = {
  title: "Admin/Shell/AdminNotificationPanel",
  component: AdminNotificationPanel,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "The live notification panel used by CanvasLayout. This story exercises the real garden selection and derived workspace data against deterministic query fixtures.",
      },
    },
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withRouter([`/hub?gardenId=${STORYBOOK_PRIMARY_ADMIN_GARDEN.id}`]),
    withAdminPrimitiveFrame,
  ],
  args: {
    onCloseSheet: () => undefined,
  },
} satisfies Meta<typeof AdminNotificationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectedGardenUpdates: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Updates for Rio Rainforest Lab")).toBeVisible();
    await expect(await canvas.findByText("Needs attention")).toBeVisible();
    await expect(await canvas.findByText("Recent activity")).toBeVisible();
  },
};
