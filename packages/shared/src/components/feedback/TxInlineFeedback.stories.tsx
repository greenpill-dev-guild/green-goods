import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../Button";
import { TxHoldFeedback, TxInlineFeedback } from "./TxInlineFeedback";

const meta: Meta<typeof TxInlineFeedback> = {
  title: "Shared/Feedback/TxInlineFeedback",
  component: TxInlineFeedback,
  tags: ["autodocs"],
  argTypes: {
    severity: {
      control: "select",
      options: ["error", "warning", "info"],
    },
    visible: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TxInlineFeedback>;

export const Info: Story = {
  args: {
    visible: true,
    severity: "info",
    title: "Awaiting wallet confirmation",
    message: "Approve the transaction in your wallet to continue.",
  },
};

export const Warning: Story = {
  args: {
    visible: true,
    severity: "warning",
    title: "Allowance may be insufficient",
    message: "You may need to approve spending before the transaction can be submitted.",
  },
};

export const Error: Story = {
  args: {
    visible: true,
    severity: "error",
    title: "Transaction failed",
    message: "The latest simulation reverted. Review the inputs and try again.",
    action: (
      <Button size="sm" emphasis="secondary">
        Retry simulation
      </Button>
    ),
  },
};

export const HiddenReserve: Story = {
  args: {
    visible: false,
    severity: "info",
    title: "Hidden",
    message: "Reserved layout space for future inline feedback.",
  },
};

type HoldStory = StoryObj<typeof TxHoldFeedback>;

const HOLD_ARGS = {
  title: "We couldn’t confirm your last deposit.",
  message:
    "It could still land, so deposits here are paused until you check again or move on. If it lands after you move on, you’ll have deposited twice.",
  detail: "You tried to deposit 5 DAI. You have 41 DAI in this vault now.",
  hasUnreadValues: false,
  isSettling: false,
  onCheckAgain: fn(),
  onMoveOn: fn(),
};

/** A send whose outcome nobody can say yet, read from the chain: either way forward is open. */
export const Hold: HoldStory = {
  tags: ["storybook-ci"],
  render: (args) => <TxHoldFeedback {...args} />,
  args: HOLD_ARGS,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Check Again" }));
    await expect(args.onCheckAgain).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Move On" }));
    await expect(args.onMoveOn).toHaveBeenCalledOnce();
  },
};

/** The chain couldn't be read, so moving on waits: nobody moves on from a value they haven't seen. */
export const HoldUnread: HoldStory = {
  tags: ["storybook-ci"],
  render: (args) => <TxHoldFeedback {...args} />,
  args: { ...HOLD_ARGS, detail: "You tried to deposit 5 DAI.", hasUnreadValues: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/couldn’t be read just now/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Check Again" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Move On" })).toBeDisabled();
  },
};

/** Another send is in flight, so neither way forward is open until it ends. */
export const HoldBusy: HoldStory = {
  tags: ["storybook-ci"],
  render: (args) => <TxHoldFeedback {...args} />,
  args: { ...HOLD_ARGS, isBusy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Check Again" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Move On" })).toBeDisabled();
  },
};
