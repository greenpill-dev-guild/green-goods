import type { Meta, StoryObj } from "@storybook/react";
import { RiMailLine, RiSearchLine } from "@remixicon/react";
import { AdminTextField } from "./AdminTextField";

const meta: Meta<typeof AdminTextField> = {
  title: "Admin/Primitives/AdminTextField",
  component: AdminTextField,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Text Field with filled and outlined variants. Floating label animates between resting (body-lg) and floating (body-sm). Active indicator line (filled) or outline ring (outlined) reflects focus/error state. forwardRef compatible for react-hook-form.",
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
    placeholder: "Search gardens…",
  },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const WithHelper: Story = {
  args: {
    label: "Email address",
    variant: "filled",
    helperText: "Used for garden invitations and notifications.",
    leadingIcon: RiMailLine,
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

export const Disabled: Story = {
  args: { label: "Chain ID", variant: "outlined", defaultValue: "11155111", disabled: true },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <AdminTextField label="Filled (empty)" variant="filled" />
      <AdminTextField label="Outlined (empty)" variant="outlined" />
      <AdminTextField label="Filled (value)" variant="filled" defaultValue="North Meadow" />
      <AdminTextField label="Outlined (value)" variant="outlined" defaultValue="North Meadow" />
      <AdminTextField
        label="Filled error"
        variant="filled"
        defaultValue="oops"
        error="Something went wrong"
      />
      <AdminTextField label="Disabled" variant="outlined" defaultValue="Locked" disabled />
    </div>
  ),
};
