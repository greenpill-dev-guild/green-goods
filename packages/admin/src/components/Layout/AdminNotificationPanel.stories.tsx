import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Work } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
  STORYBOOK_STEWARD_ADDRESS,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withAdminPrimitiveFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { daysAgo } from "../../../../shared/.storybook/fixtures";
import { AdminNotificationPanel } from "./AdminNotificationPanel";

/**
 * A submission that has waited ten days, with no review since: the queue has
 * stalled (DL-044). Waiting work raises no alert before a week, and the shared
 * shell seeds keep theirs younger.
 */
const WAITING_WORK: Work = {
  id: "work-rio-soil-1",
  title: "Soil moisture readings",
  actionUID: 1,
  gardenerAddress: STORYBOOK_STEWARD_ADDRESS,
  gardenAddress: STORYBOOK_PRIMARY_ADMIN_GARDEN.id,
  feedback: "Readings from the three south plots.",
  metadata: JSON.stringify({ schemaVersion: "work_metadata_v2", actionSlug: "canopy-baseline" }),
  media: [],
  createdAt: daysAgo(10),
  status: "pending",
};

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
    withSeededQueryClient([
      ...STORYBOOK_ADMIN_SHELL_SEEDS,
      [queryKeys.works.merged(STORYBOOK_PRIMARY_ADMIN_GARDEN.id, DEFAULT_CHAIN_ID), [WAITING_WORK]],
    ]),
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
    await expect(
      await canvas.findByText("No reviews in 7 days, and 1 work is waiting.")
    ).toBeVisible();
    await expect(await canvas.findByText("Recent activity")).toBeVisible();
  },
};
