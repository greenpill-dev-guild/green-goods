import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { WalletCancellationRecovery } from "./WalletCancellationRecovery";
const meta: Meta<typeof WalletCancellationRecovery> = {
  title: "Admin/Workflows/WalletCancellationRecovery",
  component: WalletCancellationRecovery,
  tags: ["autodocs", "storybook-ci"],
  args: { onCheck: fn(), onConfirmCancellation: fn(async () => {}) },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Pending: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Review Cancellation" }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole("alertdialog");
    await expect(within(dialog).getByText(/First confirm in your wallet/)).toBeVisible();
    await expect(args.onConfirmCancellation).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel", exact: true }));
    await expect(args.onConfirmCancellation).not.toHaveBeenCalled();
  },
};
export const Checking: Story = { args: { disabled: true } };
