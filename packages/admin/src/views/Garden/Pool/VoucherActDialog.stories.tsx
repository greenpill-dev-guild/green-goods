import { Alert } from "@green-goods/shared/components/Alert";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, within } from "storybook/test";
import { VoucherActDialog } from "./VoucherActDialog";

const meta: Meta<typeof VoucherActDialog> = {
  title: "Admin/Pool/VoucherActDialog",
  component: VoucherActDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The shell every voucher act's dialog shares (PRD-1297 surface 6, dial V5): the cockpit's confirm dialog, busy while its act runs, closed when the act lands, and kept open with Try Again and a line saying nothing changed when it fails. The body ends with who signs: the wallet's prompt, or the Safe's signature count read from the Safe.",
      },
    },
  },
  args: {
    open: true,
    title: "Approve Lina’s Booking?",
    description: "Hub day, up to 4 hours",
    confirmLabel: "Approve Booking",
    note: "Your Safe needs 1 signature.",
    tone: "garden",
    onClose: () => undefined,
    act: async () => undefined,
    children: (
      <Alert variant="info" title="Approving lets Lina deposit">
        It isn’t acceptance. You accept after the deposit is confirmed on Green Goods.
      </Alert>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof VoucherActDialog>;

/** Ready to send: the note closes the body. */
export const Ready: Story = {};

/** The act didn't go through: the dialog stays, says nothing changed, and offers it again. */
export const ActFailed: Story = {
  args: {
    act: async () => {
      throw new Error("The Safe declined the transaction");
    },
  },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Approve Booking" }));
    await expect(await dialog.findByText(/nothing changed/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Try Again" })).toBeEnabled();
  },
};
