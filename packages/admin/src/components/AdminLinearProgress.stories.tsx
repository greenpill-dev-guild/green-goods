import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminLinearProgress } from "./AdminLinearProgress";

const meta: Meta<typeof AdminLinearProgress> = {
  title: "Admin/Primitives/AdminLinearProgress",
  component: AdminLinearProgress,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 linear progress. Determinate when value is provided, indeterminate when value is undefined. Uses 4dp track height and M3 surface/primary roles.",
      },
    },
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof AdminLinearProgress>;

export const Indeterminate: Story = {
  args: { ariaLabel: "Syncing submissions" },
  render: (args) => (
    <div className="max-w-xl">
      <AdminLinearProgress {...args} />
    </div>
  ),
};

export const Determinate: Story = {
  args: { value: 65, ariaLabel: "Upload progress" },
  render: (args) => (
    <div className="max-w-xl">
      <AdminLinearProgress {...args} />
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="max-w-xl space-y-5">
      <div className="space-y-2">
        <div className="text-label-lg text-[rgb(var(--m3-on-surface))]">Indeterminate</div>
        <AdminLinearProgress ariaLabel="Loading work queue" />
      </div>
      {[0, 25, 50, 75, 100].map((value) => (
        <div key={value} className="space-y-2">
          <div className="text-label-lg text-[rgb(var(--m3-on-surface-variant))]">
            {value} percent
          </div>
          <AdminLinearProgress value={value} ariaLabel={`${value} percent complete`} />
        </div>
      ))}
    </div>
  ),
};
