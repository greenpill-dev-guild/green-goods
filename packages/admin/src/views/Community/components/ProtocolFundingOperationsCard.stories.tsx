import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, within } from "storybook/test";
import {
  storyProtocolFundingOperations,
  storyProtocolSafeFunding,
} from "@/views/Garden/Pool/poolStorySettlement";
import { ProtocolFundingOperationsCard } from "./ProtocolFundingOperationsCard";

const AIYELOJA = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;

const meta: Meta<typeof ProtocolFundingOperationsCard> = {
  title: "Admin/Community/ProtocolFundingOperationsCard",
  component: ProtocolFundingOperationsCard,
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
type Story = StoryObj<typeof ProtocolFundingOperationsCard>;

export const ProtocolSteward: Story = {
  args: {
    operations: storyProtocolFundingOperations(),
    gardens: [{ id: AIYELOJA, name: "Aiyeloja" }],
    targetGarden: AIYELOJA,
    onTargetGardenChange: () => undefined,
  },
};

export const DeployerReadOnly: Story = {
  args: {
    operations: storyProtocolFundingOperations({
      canQueueFunding: false,
      canDispatchOrRetry: false,
      canRequeueOrCancel: false,
      rows: storyProtocolFundingOperations().rows.map((row) => ({
        ...row,
        canDispatch: false,
        canCancel: false,
      })),
    }),
    gardens: [{ id: AIYELOJA, name: "Aiyeloja" }],
    targetGarden: AIYELOJA,
    onTargetGardenChange: () => undefined,
  },
};

/** Dispatch opens the review first: amount, receiving garden, one transaction. */
export const ReviewBeforeDispatch: Story = {
  args: {
    operations: storyProtocolFundingOperations(),
    gardens: [{ id: AIYELOJA, name: "Aiyeloja" }],
    targetGarden: AIYELOJA,
    onTargetGardenChange: () => undefined,
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Dispatch…" }));
    const review = await screen.findByRole("alertdialog", { name: "Review Before Sending" });
    await expect(review).toHaveTextContent(/to Aiyeloja/);
  },
};

/** A 7.2M seed against the 7M cap: the field names the limit and the review stays shut. */
export const AmountOverTransferCap: Story = {
  args: {
    operations: storyProtocolFundingOperations({ sourceFunding: storyProtocolSafeFunding() }),
    gardens: [{ id: AIYELOJA, name: "Aiyeloja" }],
    targetGarden: AIYELOJA,
    onTargetGardenChange: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const amount = canvas.getByLabelText("Amount (G$)");
    await userEvent.clear(amount);
    await userEvent.type(amount, "7200000");
    await expect(canvas.getByRole("alert")).toHaveTextContent("More than the per-transfer cap.");
    await expect(canvas.getByRole("button", { name: "Review Seed or Top-Up…" })).toBeDisabled();
  },
};
