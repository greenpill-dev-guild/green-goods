import type { Meta, StoryObj } from "@storybook/react";
import { STORY_MARIA, storyCommitmentDialog } from "../poolStoryFixtures";
import {
  CommitmentDeclineClaimDialog,
  CommitmentFallbackDialog,
  CommitmentReasonDialogs,
} from "./CommitmentReasonDialogs";

const dialog = storyCommitmentDialog();
const REASONED = {
  onClose: () => undefined,
  tone: "garden" as const,
  acts: dialog.acts,
  blockedReason: undefined,
};

const meta: Meta<typeof CommitmentReasonDialogs> = {
  title: "Admin/Pool/CommitmentReasonDialogs",
  component: CommitmentReasonDialogs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The reasoned acts on a live commitment: call it off, mark it ready over the recipient's send, freeze it for review, confirm it when nobody on the ordinary path can, or decline one request to take it up. None of them can be sent blank, and the member reads the reason rather than the bare state.",
      },
    },
  },
  args: { ...REASONED, open: "cancel" },
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentReasonDialogs>;

export const Cancel: Story = {};

export const MarkReady: Story = {
  args: { open: "mark-ready" },
};

export const RaiseDispute: Story = {
  args: { open: "raise-dispute" },
};

export const GardenFallbackConfirm: Story = {
  render: () => (
    <CommitmentFallbackDialog {...REASONED} open="fallback-confirm" fallbackPath="POOL_FALLBACK" />
  ),
};

export const DeclineRequest: Story = {
  render: () => (
    <CommitmentDeclineClaimDialog
      {...REASONED}
      open={{ kind: "decline-claim", claimant: STORY_MARIA }}
    />
  ),
};
