import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";
import { PoolTarget } from "./PoolTarget";
import { TransferReviewDialog } from "./TransferReviewDialog";

const G = 10n ** 18n;

const meta: Meta<typeof TransferReviewDialog> = {
  title: "Admin/Pool/TransferReviewDialog",
  component: TransferReviewDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The review before a disbursement goes out: what it is, how much, to whom, and which act sends it. A commitment's payout disbursements and the protocol's transfers to gardens share it.",
      },
    },
  },
  args: {
    review: { act: "dispatch", disbursementId: 40n },
    amount: 2n * G,
    recipient: "Aiyeloja",
    tone: "community",
    isLoading: false,
    onClose: () => undefined,
    onConfirm: async () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="community">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TransferReviewDialog>;

/** A protocol transfer, named by the garden that receives it. */
export const Dispatch: Story = {
  play: async () => {
    const review = await screen.findByRole("alertdialog", { name: "Review Before Sending" });
    await expect(review).toHaveTextContent(/Dispatch disbursement #40 for 2 G\$ to Aiyeloja/);
  },
};

export const RetryCommand: Story = {
  args: { review: { act: "retry", disbursementId: 40n } },
  play: async () => {
    const review = await screen.findByRole("alertdialog", { name: "Review Before Sending" });
    await expect(review).toHaveTextContent(/disbursement #40: 2 G\$ to Aiyeloja/);
  },
};

export const Requeue: Story = {
  args: { review: { act: "requeue", disbursementId: 40n } },
  play: async () => {
    const review = await screen.findByRole("alertdialog", { name: "Review Before Sending" });
    await expect(review).toHaveTextContent(/disbursement #40: 2 G\$ to Aiyeloja/);
  },
};

/** A commitment payout carries its pool and record into the transfer review. */
export const CommitmentPayout: Story = {
  args: {
    target: (
      <PoolTarget target={{ gardenName: "Rocinha", isProtocol: false }} record="Community meal" />
    ),
  },
  play: async () => {
    const review = await screen.findByRole("alertdialog", { name: "Review Before Sending" });
    await expect(review).toHaveTextContent("“Community meal” in Rocinha’s pool");
  },
};

export const Sending: Story = {
  args: { isLoading: true },
};
