import type { Meta, StoryObj } from "@storybook/react";
import { storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentActions } from "./CommitmentActions";

const dialog = storyCommitmentDialog();
const OFFLINE_NOTE = "Needs a connection. Pool changes are sent straight to the chain.";

const meta: Meta<typeof CommitmentActions> = {
  title: "Admin/Pool/CommitmentActions",
  component: CommitmentActions,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The row of acts at the foot of a commitment, carrying only what the reader's authority and the record's state allow. Without a connection it says so above the row, because every act here goes straight to the chain.",
      },
    },
  },
  args: {
    isOnline: true,
    offlineNote: OFFLINE_NOTE,
    can: dialog.can,
    acts: dialog.acts,
    actDisabled: false,
    isActing: false,
    fallbackPath: null,
    onOpenDialog: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentActions>;

export const SendForConfirmation: Story = {};

export const UnderReview: Story = {
  args: {
    can: {
      ...dialog.can,
      raiseDispute: false,
      sendForConfirmation: false,
      resolveDispute: true,
      expire: true,
    },
  },
};

export const OrdinaryUnreachable: Story = {
  args: {
    can: { ...dialog.can, sendForConfirmation: false, confirmFallback: true },
    fallbackPath: "PROTOCOL_FALLBACK",
  },
};

export const Offline: Story = {
  args: { isOnline: false, actDisabled: true },
};
