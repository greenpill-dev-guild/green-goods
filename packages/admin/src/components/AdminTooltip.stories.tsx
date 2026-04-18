import type { Meta, StoryObj } from "@storybook/react";
import { RiInformationLine, RiSettings4Line } from "@remixicon/react";
import { AdminTooltip } from "./AdminTooltip";

const meta: Meta<typeof AdminTooltip> = {
  title: "Admin/AdminTooltip",
  component: AdminTooltip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Lightweight tooltip shown on hover/focus. Positioned above the trigger via absolute placement with z-overlay. Inverse-surface background with fade+zoom entrance.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminTooltip>;

export const Default: Story = {
  render: () => (
    <div className="p-24">
      <AdminTooltip content="Open settings">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--m3-surface-container-high))]"
          aria-label="Settings"
        >
          <RiSettings4Line className="h-5 w-5 text-[rgb(var(--m3-on-surface))]" />
        </button>
      </AdminTooltip>
    </div>
  ),
};

export const OnText: Story = {
  render: () => (
    <div className="p-24">
      <AdminTooltip content="Tooltips wrap any trigger content and appear on hover or keyboard focus.">
        <span className="inline-flex items-center gap-1 text-body-sm text-[rgb(var(--m3-primary))] underline underline-offset-2">
          <RiInformationLine className="h-4 w-4" /> what is this?
        </span>
      </AdminTooltip>
    </div>
  ),
};
