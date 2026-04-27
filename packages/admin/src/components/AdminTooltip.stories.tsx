import { RiInformationLine, RiSettings4Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminTooltip } from "./AdminTooltip";

const meta: Meta<typeof AdminTooltip> = {
  title: "Admin/Primitives/AdminTooltip",
  component: AdminTooltip,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 tooltip with stable id, trigger aria-describedby, inverse-surface colors, and tokenized fade/scale motion.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminTooltip>;

export const IconTrigger: Story = {
  render: () => (
    <div className="p-16">
      <AdminTooltip content="Open settings">
        <button
          type="button"
          className="m3-state-layer inline-flex h-10 w-10 items-center justify-center rounded-[var(--m3-shape-full)] bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface))] [--state-layer-color:var(--m3-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]"
          aria-label="Settings"
        >
          <RiSettings4Line className="h-5 w-5" />
        </button>
      </AdminTooltip>
    </div>
  ),
};

export const TextTrigger: Story = {
  render: () => (
    <div className="p-16">
      <AdminTooltip content="This filter limits the queue to submissions assigned to you.">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-[var(--m3-shape-sm)] px-2 py-1 text-body-md text-[rgb(var(--m3-primary))] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]"
        >
          <RiInformationLine className="h-4 w-4" /> Assignment filter
        </button>
      </AdminTooltip>
    </div>
  ),
};

export const BottomStart: Story = {
  render: () => (
    <div className="p-16">
      <AdminTooltip content="Back to garden workspace" placement="bottom-start">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--m3-shape-full)] bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface))]"
          aria-label="Back to garden workspace"
        >
          <RiSettings4Line className="h-5 w-5" />
        </button>
      </AdminTooltip>
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6 p-16">
      <AdminTooltip content="Open settings">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--m3-shape-full)] bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface))]"
          aria-label="Settings"
        >
          <RiSettings4Line className="h-5 w-5" />
        </button>
      </AdminTooltip>
      <AdminTooltip content="Explains the currently selected queue filter.">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-[var(--m3-shape-sm)] px-2 py-1 text-body-md text-[rgb(var(--m3-primary))]"
        >
          <RiInformationLine className="h-4 w-4" /> Help text
        </button>
      </AdminTooltip>
      <AdminTooltip content="Back to garden workspace" placement="bottom-start">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--m3-shape-full)] bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface))]"
          aria-label="Back to garden workspace"
        >
          <RiSettings4Line className="h-5 w-5" />
        </button>
      </AdminTooltip>
    </div>
  ),
};
