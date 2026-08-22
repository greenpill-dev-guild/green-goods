import type { DisputeResolutionKey } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentResolveDialog } from "./CommitmentResolveDialog";

/** The outcome picker is controlled; the story holds the steward's choice. */
function CommitmentResolveDialogWithOutcome(props: ComponentProps<typeof CommitmentResolveDialog>) {
  const [resolution, setResolution] = useState<DisputeResolutionKey>(props.resolution);
  return (
    <CommitmentResolveDialog
      {...props}
      resolution={resolution}
      onResolutionChange={setResolution}
    />
  );
}

const dialog = storyCommitmentDialog();

const meta: Meta<typeof CommitmentResolveDialog> = {
  title: "Admin/Pool/CommitmentResolveDialog",
  component: CommitmentResolveDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Ending a review, and on what terms. The outcomes on offer follow the reader's standing, and every one of them records its reason in the member's timeline.",
      },
    },
  },
  args: {
    open: "resolve-dispute",
    onClose: () => undefined,
    tone: "garden",
    can: { ...dialog.can, resolveDispute: true, resolveFulfilled: true },
    acts: dialog.acts,
    resolution: "RESTORE_PREVIOUS",
    onResolutionChange: () => undefined,
    blockedReason: undefined,
  },
  render: (args) => <CommitmentResolveDialogWithOutcome {...args} />,
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentResolveDialog>;

export const KeptOnOffer: Story = {};

export const KeptWithheld: Story = {
  args: { can: { ...dialog.can, resolveDispute: true, resolveFulfilled: false } },
};

export const Offline: Story = {
  args: {
    blockedReason: "Needs a connection. Pool changes are sent straight to the chain.",
  },
};
