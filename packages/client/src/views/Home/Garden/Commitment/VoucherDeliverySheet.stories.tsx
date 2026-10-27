import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { serviceAccessStorySnapshot } from "./serviceAccessStoryFixtures";
import { VoucherDeliverySheet } from "./VoucherDeliverySheet";

const snapshot = serviceAccessStorySnapshot(true);
const meta: Meta<typeof VoucherDeliverySheet> = {
  title: "Client/Commitments/VoucherDeliverySheet",
  component: VoucherDeliverySheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    snapshot,
    setup: snapshot.voucherSetups[0],
    isPending: false,
    onOpenChange: fn(),
    onConfirm: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof VoucherDeliverySheet>;
export const ReviewFinalAllocation: Story = {};
export const Sending: Story = { args: { isPending: true } };
