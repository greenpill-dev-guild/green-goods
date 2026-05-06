import type { Address, Work } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  FIXTURE_WORK_MEDIA,
  STORYBOOK_NOW_SECONDS,
  daysAgo,
  hoursAgo,
} from "../../../../../shared/.storybook/fixtures";
import { WorkSubmissionsView } from "./WorkSubmissionsView";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

function work(
  id: string,
  title: string,
  status: "pending" | "approved" | "rejected",
  daysAgoCount: number,
  mediaIndex = 0
): Work {
  return {
    id,
    title,
    actionUID: 1,
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [FIXTURE_WORK_MEDIA[mediaIndex % FIXTURE_WORK_MEDIA.length]],
    createdAt: daysAgo(daysAgoCount),
    status,
  };
}

const WORKS: Work[] = [
  work("w1", "Planted 50 native saplings", "pending", 1, 0),
  work("w2", "Riverbank cleanup cycle", "pending", 3, 3),
  work("w3", "Composting workshop", "approved", 10, 2),
  work("w4", "Solar panel install", "rejected", 14, 1),
];

const meta: Meta<typeof WorkSubmissionsView> = {
  title: "Admin/Workflows/Hub/WorkSubmissionsView",
  component: WorkSubmissionsView,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/hub"])],
  parameters: {
    docs: {
      description: {
        component:
          "Filter-backed grid of real work cards. Passing `works` keeps the view data-driven by fixtures while the Storybook admin identity satisfies the shared hook/provider contract.",
      },
    },
  },
  args: {
    gardenId: "0x1234567890123456789012345678901234567890",
    canManage: true,
    canReview: true,
    works: WORKS,
    isLoading: false,
    isRefreshing: false,
    // Last-updated timestamp five minutes before the fixed Storybook clock.
    lastUpdatedAt: STORYBOOK_NOW_SECONDS - 300,
    onRefresh: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof WorkSubmissionsView>;

export const Default: Story = {};

export const PendingFilter: Story = {
  args: { initialFilter: "pending" },
};

export const AllFilter: Story = {
  args: { initialFilter: "all" },
};

export const Loading: Story = {
  args: {
    works: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    works: [],
    isLoading: false,
  },
};

export const Highlighted: Story = {
  args: {
    highlightWorkId: "w2",
    initialFilter: "pending",
  },
};

export const FreshlyRefreshed: Story = {
  args: {
    lastUpdatedAt: hoursAgo(0.1),
  },
};
