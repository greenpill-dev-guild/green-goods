import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminCheckbox } from "./AdminCheckbox";

const meta: Meta<typeof AdminCheckbox> = {
  title: "Admin/Primitives/AdminCheckbox",
  component: AdminCheckbox,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 checkbox with 18dp container, 40dp touch target, selected, indeterminate, error, disabled, label, and supporting text states.",
      },
    },
  },
  argTypes: {
    checked: { control: "boolean" },
    indeterminate: { control: "boolean" },
    error: { control: "boolean" },
    disabled: { control: "boolean" },
    label: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminCheckbox>;

export const Default: Story = {
  args: { label: "Review required", defaultChecked: false },
};

export const Checked: Story = {
  args: { label: "Notifications enabled", defaultChecked: true },
};

export const Indeterminate: Story = {
  args: {
    label: "Some submissions selected",
    description: "Bulk actions apply to the selected rows only.",
    indeterminate: true,
  },
};

export const Error: Story = {
  args: {
    label: "Confirm transaction",
    description: "This is required to continue.",
    error: true,
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-2">
      <AdminCheckbox label="Unchecked" />
      <AdminCheckbox label="Checked" defaultChecked />
      <AdminCheckbox label="Indeterminate" indeterminate />
      <AdminCheckbox label="Error" description="Required before submission." error />
      <AdminCheckbox label="Disabled" disabled />
      <AdminCheckbox label="Disabled checked" defaultChecked disabled />
    </div>
  ),
};
