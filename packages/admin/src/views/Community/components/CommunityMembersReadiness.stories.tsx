import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { CommunityReadinessCard } from "./CommunityMembersReadiness";

const meta = {
  title: "Admin/Workflows/Community/Readiness",
  component: CommunityReadinessCard,
  tags: ["autodocs"],
  decorators: [withAdminIdentity],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The Gardeners rail's count of members at each readiness stage (PRD-1537), read from what the garden records of them. One row is one account, so people who share a phone are not counted apart.",
      },
    },
  },
  args: { counts: { registered: 4, gettingStarted: 3, contributing: 7, unknown: 0 } },
} satisfies Meta<typeof CommunityReadinessCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stages: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Contributing")).toBeVisible();
    // A stage nobody's records left unread stays out of the list.
    await expect(canvas.queryByText("Not known")).toBeNull();
  },
};

/** Some members' records could not be read: they are counted as not known, never as registered. */
export const SomeNotKnown: Story = {
  args: { counts: { registered: 2, gettingStarted: 1, contributing: 5, unknown: 3 } },
};
