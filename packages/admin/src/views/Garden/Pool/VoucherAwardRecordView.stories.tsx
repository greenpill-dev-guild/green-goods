import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { VoucherAwardRecordView } from "./VoucherAwardRecordView";
import { awardStoryRecord } from "./voucherAwardStoryFixtures";
const meta: Meta<typeof VoucherAwardRecordView> = {
  title: "Admin/Pool/VoucherAwardRecord",
  component: VoucherAwardRecordView,
  tags: ["autodocs"],
  argTypes: { record: { control: false } },
  args: {
    record: awardStoryRecord,
    decimals: 6,
    issuerName: "Fictional hub days",
    disabled: false,
    recovered: true,
    uncertain: false,
    directSigningAvailable: true,
    onSend: fn(),
    onRecover: fn(),
    onReconcile: fn(),
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
type Story = StoryObj<typeof VoucherAwardRecordView>;
export const ReviewBeforeSigning: Story = {};
export const Uncertain: Story = { args: { uncertain: true } };
export const Delivered: Story = {
  args: {
    record: { ...awardStoryRecord, state: "confirmed", transactionHash: `0x${"c".repeat(64)}` },
  },
};
