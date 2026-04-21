import type { Meta, StoryObj } from "@storybook/react";
import { AdminCheckbox } from "./AdminCheckbox";

const meta: Meta<typeof AdminCheckbox> = {
  title: "Admin/Primitives/AdminCheckbox",
  component: AdminCheckbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 checkbox with 18dp container, 40dp touch target, and SVG checkmark. Supports label + description, error state, and disabled state. forwardRef compatible for react-hook-form.",
      },
    },
  },
  argTypes: {
    checked: { control: "boolean" },
    error: { control: "boolean" },
    disabled: { control: "boolean" },
    label: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminCheckbox>;

export const Default: Story = {
  args: { label: "I agree to the terms", defaultChecked: false },
};

export const Checked: Story = {
  args: { label: "Notifications enabled", defaultChecked: true },
};

export const WithDescription: Story = {
  args: {
    label: "Weekly digest",
    description: "Summary of pending submissions and garden health each Monday.",
    defaultChecked: true,
  },
};

export const Error: Story = {
  args: {
    label: "I confirm the transaction",
    description: "This is required to proceed.",
    error: true,
  },
};

export const Disabled: Story = {
  args: { label: "Automatic deployments", defaultChecked: true, disabled: true },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <AdminCheckbox label="Unchecked" />
      <AdminCheckbox label="Checked" defaultChecked />
      <AdminCheckbox label="Error" error />
      <AdminCheckbox label="Disabled" disabled />
      <AdminCheckbox label="Disabled checked" defaultChecked disabled />
    </div>
  ),
};
