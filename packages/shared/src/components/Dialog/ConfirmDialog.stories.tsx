import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { fn } from "storybook/test";
import { ConfirmDialog } from "./ConfirmDialog";

const meta: Meta<typeof ConfirmDialog> = {
  title: "Feedback/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Accessible confirmation dialog using Radix Dialog. Centered on desktop, slides up from bottom on mobile. Replaces window.confirm() for consistent UX.",
      },
    },
  },
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Whether the dialog is open",
    },
    title: {
      control: "text",
      description: "Dialog title",
    },
    description: {
      control: "text",
      description: "Optional description below the title",
    },
    variant: {
      control: "select",
      options: ["default", "warning", "danger"],
      description: "Visual variant — warning/danger shows an alert icon and colored confirm button",
    },
    confirmLabel: {
      control: "text",
      description: "Custom confirm button label (defaults to i18n 'Confirm')",
    },
    cancelLabel: {
      control: "text",
      description: "Custom cancel button label (defaults to i18n 'Cancel')",
    },
    isLoading: {
      control: "boolean",
      description: "Shows spinner on confirm button and prevents closing",
    },
    onClose: { action: "onClose" },
    onConfirm: { action: "onConfirm" },
    onCancel: { action: "onCancel" },
    onError: { action: "onError" },
  },
  args: {
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const Default: Story = {
  args: {
    isOpen: true,
    title: "Confirm Action",
    description: "Are you sure you want to proceed with this action?",
  },
};

export const Destructive: Story = {
  args: {
    isOpen: true,
    title: "Remove Member",
    description:
      "This will revoke their garden access and remove all pending work submissions. This action cannot be undone.",
    variant: "danger",
    confirmLabel: "Remove",
  },
};

export const Warning: Story = {
  args: {
    isOpen: true,
    title: "Unsaved Changes",
    description: "You have unsaved changes that will be lost if you leave this page.",
    variant: "warning",
    confirmLabel: "Leave Page",
    cancelLabel: "Stay",
  },
};

export const Loading: Story = {
  args: {
    isOpen: true,
    title: "Processing Transaction",
    description: "Please wait while the transaction is confirmed on-chain.",
    isLoading: true,
    confirmLabel: "Confirming...",
  },
};

export const NoDescription: Story = {
  args: {
    isOpen: true,
    title: "Delete this item?",
    variant: "danger",
    confirmLabel: "Delete",
  },
};

/**
 * KNOWN BUG: In dark mode, `bg-bg-strong` resolves to #F5F5F5 and `text-text-strong`
 * resolves to #F7F7F7, giving a contrast ratio of approximately 1:1.
 * This makes text nearly invisible against the background.
 *
 * The dialog itself uses `bg-bg-white-0` (which is dark in dark mode) and
 * `text-text-strong-950` which should be correct, but any parent elements or
 * overlays using `bg-bg-strong` + `text-text-strong` will have this issue.
 *
 * Toggle the Storybook theme toolbar to "Dark" to observe.
 */
export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4 min-h-[400px]">
        <Story />
      </div>
    ),
  ],
  args: {
    isOpen: true,
    title: "Dark Mode Dialog",
    description:
      "Check text contrast carefully. Known bug: bg-bg-strong + text-text-strong gives ~1:1 contrast ratio in dark mode.",
    variant: "danger",
    confirmLabel: "Delete Garden",
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-sm font-semibold text-text-sub-600 mb-2">Default Variant</h3>
        <ConfirmDialog
          isOpen={true}
          onClose={fn()}
          onConfirm={fn()}
          title="Confirm Action"
          description="Are you sure you want to proceed?"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Gallery shows one dialog at a time since Radix Portal renders overlapping overlays. Use individual stories to see each variant.",
      },
    },
  },
};

export const Interactive: Story = {
  args: {
    isOpen: true,
    title: "Confirm Withdrawal",
    description: "Withdraw 1.5 ETH from the garden vault?",
    confirmLabel: "Withdraw",
    cancelLabel: "Keep Funds",
    onConfirm: fn(),
    onClose: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // The dialog renders in a portal, so query from the document body
    const dialog = within(document.body);

    // Verify the dialog is rendered
    const dialogElement = await dialog.findByTestId("confirm-dialog");
    await expect(dialogElement).toBeInTheDocument();

    // Verify title is shown
    const title = await dialog.findByText("Confirm Withdrawal");
    await expect(title).toBeInTheDocument();

    // Verify description is shown
    const description = await dialog.findByText("Withdraw 1.5 ETH from the garden vault?");
    await expect(description).toBeInTheDocument();

    // Click the confirm button
    const confirmButton = await dialog.findByText("Withdraw");
    await userEvent.click(confirmButton);
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const InteractiveCancel: Story = {
  args: {
    isOpen: true,
    title: "Remove Member",
    description: "Remove this gardener from the team?",
    variant: "danger",
    confirmLabel: "Remove",
    cancelLabel: "Keep",
    onConfirm: fn(),
    onClose: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    const dialog = within(document.body);

    // Verify the dialog is rendered
    await dialog.findByTestId("confirm-dialog");

    // Click the cancel button
    const cancelButton = await dialog.findByText("Keep");
    await userEvent.click(cancelButton);
    await expect(args.onCancel).toHaveBeenCalled();
  },
};

export const InteractiveClose: Story = {
  args: {
    isOpen: true,
    title: "Confirm Action",
    description: "Test closing via the X button",
    onConfirm: fn(),
    onClose: fn(),
  },
  play: async ({ args }) => {
    const dialog = within(document.body);

    // Click the close (X) button
    const closeButton = await dialog.findByTestId("confirm-dialog-close");
    await userEvent.click(closeButton);
    await expect(args.onClose).toHaveBeenCalled();
  },
};
