import type { Address, EASWork } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { FIXTURE_WORK_MEDIA, daysAgo } from "../../../../../shared/.storybook/fixtures";
import { WorkCard } from "./WorkCard";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

function work(
  id: string,
  title: string,
  status: "pending" | "approved" | "rejected",
  feedback = "",
  mediaCount = 2
): EASWork & { status: "pending" | "approved" | "rejected" } {
  return {
    id,
    title,
    actionUID: 1,
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN,
    feedback,
    metadata: "{}",
    media: FIXTURE_WORK_MEDIA.slice(0, mediaCount),
    createdAt: daysAgo(3),
    status,
  } as unknown as EASWork & { status: "pending" | "approved" | "rejected" };
}

const meta: Meta<typeof WorkCard> = {
  title: "Admin/Workflows/Hub/WorkCard",
  component: WorkCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Admin work card. Wraps the shared `WorkCardComponent` with admin-specific review actions (Approve / Reject links). Inline actions are rendered only when `canReview` is true and status is `pending`.",
      },
    },
  },
  decorators: [
    withRouter(["/hub"]),
    (Story) => (
      <div className="mx-auto max-w-lg p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WorkCard>;

export const Pending: Story = {
  args: {
    work: work("w1", "Planted 50 native saplings", "pending"),
    canReview: true,
  },
};

export const Approved: Story = {
  args: {
    work: work("w2", "Riverbank cleanup cycle", "approved", "Great evidence — clear before/after."),
    canReview: false,
  },
};

export const Rejected: Story = {
  args: {
    work: work("w3", "Solar panel install", "rejected", "Photos missing — please resubmit."),
    canReview: true,
  },
};

export const ReadOnlyPending: Story = {
  args: {
    work: work("w4", "Composting workshop", "pending"),
    canReview: false,
  },
};
