import type { Meta, StoryObj } from "@storybook/react";
import {
  STORY_FUNDED_GARDEN,
  storyProtocolFundingOperations,
} from "@/views/Garden/Pool/poolStorySettlement";
import { ProtocolFundingRows } from "./ProtocolFundingRows";

const meta: Meta<typeof ProtocolFundingRows> = {
  title: "Admin/Community/ProtocolFundingRows",
  component: ProtocolFundingRows,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The protocol's transfers to gardens, newest first. Each names the garden receiving it, not only the Celo account it lands in, and each send opens the same review a commitment's disbursements use.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="community">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProtocolFundingRows>;

export const Queued: Story = {
  args: {
    operations: storyProtocolFundingOperations({ canQueueFunding: false }),
    gardenName: (garden) =>
      garden?.toLowerCase() === STORY_FUNDED_GARDEN.toLowerCase() ? "Aiyeloja" : null,
    onReview: () => undefined,
    onCancel: () => undefined,
  },
};

export const AcknowledgmentPending: Story = {
  args: {
    operations: storyProtocolFundingOperations({
      rows: storyProtocolFundingOperations().rows.map((row) => ({
        ...row,
        state: "acknowledgement-pending",
        canDispatch: false,
        canCancel: false,
      })),
    }),
    gardenName: (garden) =>
      garden?.toLowerCase() === STORY_FUNDED_GARDEN.toLowerCase() ? "Aiyeloja" : null,
    onReview: () => undefined,
    onCancel: () => undefined,
  },
};
