import type { Meta, StoryObj } from "@storybook/react";
import { AdminLinearProgress } from "./AdminLinearProgress";

const meta: Meta<typeof AdminLinearProgress> = {
  title: "Admin/Primitives/AdminLinearProgress",
  component: AdminLinearProgress,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Linear Progress. Determinate when value (0–100) is provided; indeterminate when value is undefined. 4dp height, surface-container-highest track, primary fill.",
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
  args: {},
  render: (args) => (
    <div className="max-w-md">
      <AdminLinearProgress {...args} />
    </div>
  ),
};

export const Determinate: Story = {
  args: { value: 65 },
  render: (args) => (
    <div className="max-w-md">
      <AdminLinearProgress {...args} />
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <div className="space-y-1">
        <div className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">Indeterminate</div>
        <AdminLinearProgress />
      </div>
      {[0, 25, 50, 75, 100].map((v) => (
        <div key={v} className="space-y-1">
          <div className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">{v}%</div>
          <AdminLinearProgress value={v} />
        </div>
      ))}
    </div>
  ),
};
