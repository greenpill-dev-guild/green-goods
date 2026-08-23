import type { Meta, StoryObj } from "@storybook/react";
import { storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentAlerts } from "./CommitmentAlerts";

const dialog = storyCommitmentDialog();

const meta: Meta<typeof CommitmentAlerts> = {
  title: "Admin/Pool/CommitmentAlerts",
  component: CommitmentAlerts,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "What is true of a commitment right now and has to be said before any act: a review under way, a recorded cancellation, an ordinary confirmation nobody can still give, or a paused pool. Renders nothing when none of them holds.",
      },
    },
  },
  args: {
    onchainState: "ACCEPTED",
    disputeReason: dialog.disputeReason,
    cancelReason: dialog.cancelReason,
    fallbackPath: null,
    poolPaused: false,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl space-y-3 p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentAlerts>;

export const UnderReview: Story = {
  args: {
    onchainState: "DISPUTED",
    disputeReason: {
      reason: { version: 1, reason: "The repair was contested at the Saturday gathering." },
      isLoading: false,
      isUnavailable: false,
    },
  },
};

export const Cancelled: Story = {
  args: {
    onchainState: "CANCELLED",
    cancelReason: {
      reason: { version: 1, reason: "Withdrawn by agreement, the tools were mended elsewhere." },
      isLoading: false,
      isUnavailable: false,
    },
  },
};

export const OrdinaryUnreachable: Story = {
  args: { fallbackPath: "POOL_FALLBACK" },
};

export const PoolPaused: Story = {
  args: { poolPaused: true },
};
