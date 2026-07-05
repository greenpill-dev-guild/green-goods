import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { DiscardChangesDialog } from "./DiscardChangesDialog";

const meta: Meta<typeof DiscardChangesDialog> = {
  title: "Admin/Flows/DiscardChangesDialog",
  component: DiscardChangesDialog,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**DiscardChangesDialog** — the shared confirm-before-discard prompt for admin flow",
          "dialogs (Submit Work, Create Assessment, Create Hypercert). Binds the generic",
          '`app.admin.flow.discardChanges.*` copy to `AdminConfirmDialog` (`variant="warning"`)',
          "so every flow shows the same warning. Drive it with `useDirtyClose` from",
          "`@green-goods/shared` — `open`←`confirmOpen`, `onKeepEditing`←`cancelClose`,",
          "`onDiscard`←`confirmClose`.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "aria-dialog-name", enabled: true },
          { id: "button-name", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DiscardChangesDialog>;

/** The prompt as an operator sees it when closing a dirty flow. */
export const Open: Story = {
  args: {
    open: true,
    onKeepEditing: () => undefined,
    onDiscard: () => undefined,
  },
  play: async ({ canvasElement }) => {
    // AdminConfirmDialog portals to <body>, so query the document, not the canvas root.
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => {
      expect(body.getByRole("alertdialog", { name: "Discard changes?" })).toBeInTheDocument();
    });
    // Both affordances present, warning-variant confirm.
    expect(body.getByRole("button", { name: "Keep editing" })).toBeInTheDocument();
    expect(body.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  },
};

/** Closed — nothing renders above the scrim. */
export const Closed: Story = {
  args: {
    open: false,
    onKeepEditing: () => undefined,
    onDiscard: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    expect(body.queryByRole("alertdialog")).not.toBeInTheDocument();
  },
};
