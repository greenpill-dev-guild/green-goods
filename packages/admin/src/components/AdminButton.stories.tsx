import type { Meta, StoryObj } from "@storybook/react";
import { RiAddLine, RiArrowRightLine, RiDeleteBinLine } from "@remixicon/react";
import { AdminButton } from "./AdminButton";

const meta: Meta<typeof AdminButton> = {
  title: "Admin/AdminButton",
  component: AdminButton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 common button with filled, tonal, elevated, outlined, text, and danger variants. Rounded-full shape, label-lg typography, M3 state layer, spring motion.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["filled", "tonal", "elevated", "outlined", "text", "danger"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminButton>;

export const Filled: Story = {
  args: { variant: "filled", size: "md", children: "Continue" },
};

export const Tonal: Story = {
  args: { variant: "tonal", size: "md", children: "Save draft" },
};

export const Outlined: Story = {
  args: { variant: "outlined", size: "md", children: "Cancel" },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    size: "md",
    leadingIcon: <RiDeleteBinLine />,
    children: "Remove member",
  },
};

export const WithLeadingIcon: Story = {
  args: {
    variant: "filled",
    size: "md",
    leadingIcon: <RiAddLine />,
    children: "New action",
  },
};

export const Loading: Story = {
  args: { variant: "filled", loading: true, children: "Submitting…" },
};

export const VariantGallery: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <AdminButton variant="filled">Filled</AdminButton>
      <AdminButton variant="tonal">Tonal</AdminButton>
      <AdminButton variant="elevated">Elevated</AdminButton>
      <AdminButton variant="outlined">Outlined</AdminButton>
      <AdminButton variant="text" leadingIcon={<RiArrowRightLine />}>
        Text
      </AdminButton>
      <AdminButton variant="danger">Danger</AdminButton>
    </div>
  ),
};

export const SizeGallery: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      <AdminButton size="sm">Small</AdminButton>
      <AdminButton size="md">Medium</AdminButton>
      <AdminButton size="lg">Large</AdminButton>
    </div>
  ),
};
