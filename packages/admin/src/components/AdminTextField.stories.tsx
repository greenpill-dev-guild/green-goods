import { RiMailLine, RiSearchLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminTextField } from "./AdminTextField";

const meta: Meta<typeof AdminTextField> = {
  title: "Admin/Primitives/AdminTextField",
  component: AdminTextField,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 text field with filled and outlined variants, 56dp container, floating label, active indicator or outline, icon slots, supporting text, error, and disabled states.",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: ["filled", "outlined"] },
    required: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminTextField>;

export const Filled: Story = {
  args: { label: "Garden name", variant: "filled" },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const Outlined: Story = {
  args: { label: "Garden name", variant: "outlined" },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const WithLeadingIcon: Story = {
  args: {
    label: "Search",
    variant: "outlined",
    leadingIcon: RiSearchLine,
    placeholder: "Search gardens",
  },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const Error: Story = {
  args: {
    label: "Email address",
    variant: "filled",
    defaultValue: "not-an-email",
    error: "Enter a valid email address.",
    leadingIcon: RiMailLine,
  },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
      <AdminTextField label="Filled empty" variant="filled" />
      <AdminTextField label="Outlined empty" variant="outlined" />
      <AdminTextField label="Filled value" variant="filled" defaultValue="North Meadow" />
      <AdminTextField label="Outlined value" variant="outlined" defaultValue="North Meadow" />
      <AdminTextField
        label="Email address"
        variant="filled"
        helperText="Used for garden invitations."
        leadingIcon={RiMailLine}
      />
      <AdminTextField
        label="Invalid email"
        variant="filled"
        defaultValue="not-an-email"
        error="Enter a valid email address."
        leadingIcon={RiMailLine}
      />
      <AdminTextField label="Chain ID" variant="outlined" defaultValue="11155111" disabled />
      <AdminTextField label="Required field" variant="outlined" required />
    </div>
  ),
};
