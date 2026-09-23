import type { Meta, StoryObj } from "@storybook/react";
import { storyProtocolFundingOperations } from "@/views/Garden/Pool/poolStorySettlement";
import { ProtocolFundingRows } from "./ProtocolFundingRows";

const meta: Meta<typeof ProtocolFundingRows> = {
  title: "Admin/Community/ProtocolFundingRows",
  component: ProtocolFundingRows,
  tags: ["autodocs"],
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
    onSubmit: async () => undefined,
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
    onSubmit: async () => undefined,
    onCancel: () => undefined,
  },
};
