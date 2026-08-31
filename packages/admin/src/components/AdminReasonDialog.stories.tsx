import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { AdminReasonDialog } from "./AdminReasonDialog";

const meta: Meta<typeof AdminReasonDialog> = {
  title: "Admin/Dialogs/AdminReasonDialog",
  component: AdminReasonDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The reason-required confirmation every reasoned steward act uses: pause a pool, cancel a cycle, decline a claim, cancel or dispute a commitment, an override, a fallback confirmation. The primary act stays disabled until a reason is written; the description names the blast radius.",
      },
    },
  },
  args: {
    isOpen: true,
    onClose: () => undefined,
    onConfirm: async () => undefined,
    tone: "garden",
    title: "Pause This Pool",
    description:
      "Pausing stops new commitments, claims, and confirmations across 7 open commitments. Proof, work linkage, and recovery stay open; resuming clears this reason.",
    confirmLabel: "Pause Pool",
    cancelLabel: "Keep Running",
    suggestions: ["Weather or season", "Group is regrouping", "Safety first"],
  },
};

export default meta;
type Story = StoryObj<typeof AdminReasonDialog>;

export const Default: Story = {
  play: async () => {
    const dialog = within(document.body);
    const confirm = await dialog.findByRole("button", { name: "Pause Pool" });
    await expect(confirm).toBeDisabled();
    await userEvent.click(await dialog.findByRole("button", { name: "Safety first" }));
    await expect(confirm).toBeEnabled();
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    title: "Cancel This Commitment",
    description:
      "Accepted becomes Cancelled with a recorded reason. Committed units release; the member sees the reason, never “cancelled” alone.",
    confirmLabel: "Cancel Commitment",
    cancelLabel: "Keep Commitment",
    suggestions: ["Withdrawn by agreement", "No longer needed", "Duplicate commitment"],
  },
};

export const BlockedOffline: Story = {
  args: {
    blockedReason: "Needs a connection. Pool changes are sent straight to the chain.",
  },
};
