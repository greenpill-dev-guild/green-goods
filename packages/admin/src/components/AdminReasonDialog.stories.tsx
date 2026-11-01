import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
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
    onConfirm: fn(async () => undefined),
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
    title: "Cancel This Promise",
    description:
      "Accepted becomes Canceled with a recorded reason. Committed units release; the member sees the reason, never “canceled” alone.",
    confirmLabel: "Cancel Promise",
    cancelLabel: "Keep It Live",
    suggestions: ["Withdrawn by agreement", "No longer needed", "Duplicate promise"],
  },
};

export const BlockedOffline: Story = {
  args: {
    blockedReason: "Needs a connection. Pool changes are sent right away, not queued.",
  },
};

/** Text typed elsewhere (a review's Feedback) seeds the field each time the dialog opens. */
export const StartsFromTypedText: Story = {
  args: { initialReason: "Photos show a different site" },
  play: async () => {
    const dialog = within(document.body);
    await expect(await dialog.findByRole("textbox")).toHaveValue("Photos show a different site");
    await expect(await dialog.findByRole("button", { name: "Pause Pool" })).toBeEnabled();
  },
};

/** A second way to finish with the same reason, such as keeping a rejection for a batch. */
export const WithAlternative: Story = {
  tags: ["storybook-ci"],
  args: {
    title: "Reject Work",
    confirmLabel: "Reject Work",
    cancelLabel: "Cancel",
    variant: "danger",
    suggestions: ["Details are missing"],
    alternative: { label: "Add to Batch", onConfirm: fn(async () => undefined) },
  },
  play: async ({ args }) => {
    const dialog = within(document.body);
    const alternative = await dialog.findByRole("button", { name: "Add to Batch" });
    await expect(alternative).toBeDisabled();
    await userEvent.click(await dialog.findByRole("button", { name: "Details are missing" }));
    await expect(alternative).toBeEnabled();
    await userEvent.click(alternative);
    await expect(args.alternative?.onConfirm).toHaveBeenCalledWith("Details are missing");
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

export const Submitting: Story = {
  args: { initialReason: "Safety first", isLoading: true },
};

/** A failed submission leaves the dialog open with the words intact, so a retry costs nothing. */
export const FailedSubmitKeepsReason: Story = {
  args: {
    onConfirm: async () => {
      throw new Error("The wallet rejected the request");
    },
  },
  play: async () => {
    const dialog = within(document.body);
    await userEvent.type(await dialog.findByRole("textbox"), "Heavy rain this week");
    await userEvent.click(await dialog.findByRole("button", { name: "Pause Pool" }));
    await expect(await dialog.findByRole("textbox")).toHaveValue("Heavy rain this week");
    await expect(await dialog.findByRole("button", { name: "Pause Pool" })).toBeEnabled();
  },
};
