import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";
import { WithdrawSheet } from "./WithdrawSheet";

const REASON = "Plans changed, and the hedge trimmer went to another garden.";

/**
 * Withdrawing an offer or request nobody has taken up. A reason is required, the red action sits
 * over Keep It Open in the shared bar (DL-016), and the sheet holds the Tall tier so the reason
 * field stays in view above the bar.
 */
const meta: Meta<typeof WithdrawSheet> = {
  title: "Client/Commitments/WithdrawSheet",
  component: WithdrawSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    open: true,
    onOpenChange: fn(),
    direction: "OFFER",
    isPending: false,
    pinFailed: false,
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof WithdrawSheet>;

export const Offer: Story = {
  play: async ({ args }) => {
    const withdraw = await screen.findByRole("button", { name: "Withdraw This Offer" });
    await expect(withdraw).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Reason (required)" }), REASON);
    await expect(withdraw).toBeEnabled();
    await expect(withdraw.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      screen.getByRole("button", { name: "Keep It Open" }).getBoundingClientRect().top
    );
    await userEvent.click(withdraw);
    await expect(args.onConfirm).toHaveBeenCalledWith(REASON);
  },
};

export const Request: Story = {
  args: { direction: "REQUEST" },
  play: async () => {
    await expect(
      await screen.findByRole("dialog", { name: "Withdraw This Request?" })
    ).toBeVisible();
    await expect(screen.getByRole("button", { name: "Withdraw This Request" })).toBeVisible();
  },
};

export const Withdrawing: Story = {
  args: { isPending: true },
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "Withdraw This Offer" })
    ).toHaveAttribute("aria-busy", "true");
    await expect(screen.getByRole("button", { name: "Keep It Open" })).toBeDisabled();
  },
};

export const ReasonNotSaved: Story = {
  args: { pinFailed: true },
  play: async () => {
    await expect(
      await screen.findByText(
        "Your reason could not be saved, so nothing was sent. Check your connection and try again."
      )
    ).toBeVisible();
    await expect(screen.getByRole("button", { name: "Try Again" })).toBeVisible();
  },
};
