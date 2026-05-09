import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PwaSheet } from "./PwaSheet";

const meta: Meta<typeof PwaSheet> = {
  title: "Shared/Feedback/PwaSheet",
  component: PwaSheet,
  tags: ["autodocs", "storybook-ci"],
  argTypes: {
    open: { control: "boolean", description: "Whether the sheet is open" },
    onClose: { description: "Called when drag dismiss, Escape, or backdrop closes the sheet" },
    ariaLabel: { control: "text", description: "Accessible label when no header is rendered" },
    showDragHandle: { control: "boolean", description: "Render the top drag handle" },
    dragToDismiss: { control: "boolean", description: "Allow drag-to-dismiss gesture" },
  },
};

export default meta;
type Story = StoryObj<typeof PwaSheet>;

const sheetBody = (
  <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
    <header className="flex items-start justify-between">
      <div>
        <h2 className="title-section">Garden activity</h2>
        <p className="body-sm-regular text-text-sub-600">
          Drag down to dismiss. Pull from the handle, the gesture, the backdrop, or Escape.
        </p>
      </div>
    </header>
    <p className="body-md-regular">
      The PwaSheet primitive owns drag dismissal, focus trap, scroll lock, Escape, and
      reduced-motion immediate close. Consumers compose header / tabs / footer inside the body so
      the WorkDashboard, WalletDrawer, and ConvictionDrawer share one implementation.
    </p>
  </div>
);

export const Default: Story = {
  render: (args) => {
    const [open, setOpen] = useState(args.open ?? true);
    return (
      <div className="relative h-[640px] w-full max-w-sm overflow-hidden rounded-xl border border-stroke-soft-200 bg-bg-weak-50">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="m-4 rounded-md bg-primary-action px-3 py-2 text-sm text-primary-action-foreground"
        >
          Open sheet
        </button>
        <PwaSheet {...args} open={open} onClose={() => setOpen(false)}>
          {sheetBody}
        </PwaSheet>
      </div>
    );
  },
  args: {
    open: true,
    ariaLabel: "Garden activity",
    showDragHandle: true,
    dragToDismiss: true,
  },
};

export const NoDragHandle: Story = {
  render: Default.render!,
  args: { ...Default.args, showDragHandle: false },
};

export const DragDisabled: Story = {
  render: Default.render!,
  args: { ...Default.args, dragToDismiss: false },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="body-md-regular text-text-sub-600">
        Each variant of the sheet appears in adjacent device frames. Open each to interact: drag the
        handle, the body, or the backdrop. The reduced-motion path is verified in the component test
        suite (`PwaSheet.test.tsx`).
      </p>
      <div className="flex flex-wrap gap-6">
        <div className="relative h-[480px] w-72 overflow-hidden rounded-xl border border-stroke-soft-200 bg-bg-weak-50">
          <PwaSheet open onClose={() => {}} ariaLabel="Default sheet">
            {sheetBody}
          </PwaSheet>
        </div>
        <div className="relative h-[480px] w-72 overflow-hidden rounded-xl border border-stroke-soft-200 bg-bg-weak-50">
          <PwaSheet open onClose={() => {}} ariaLabel="Drag disabled" dragToDismiss={false}>
            {sheetBody}
          </PwaSheet>
        </div>
      </div>
    </div>
  ),
};
