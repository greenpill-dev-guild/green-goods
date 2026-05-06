import { RiAddLine, RiArrowRightLine, RiDeleteBinLine, RiSave3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminButton } from "./AdminButton";

const meta: Meta<typeof AdminButton> = {
  title: "Admin/Primitives/AdminButton",
  component: AdminButton,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 common button with filled, tonal, elevated, outlined, text, and danger variants. Uses full-round shape, label-large typography, M3 state layers, and tokenized spring motion.",
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

export const WithIcon: Story = {
  args: {
    variant: "filled",
    size: "md",
    leadingIcon: <RiAddLine />,
    children: "New action",
  },
};

export const Loading: Story = {
  args: { variant: "filled", loading: true, children: "Submitting" },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <AdminButton variant="filled" leadingIcon={<RiSave3Line />}>
          Filled
        </AdminButton>
        <AdminButton variant="tonal">Tonal</AdminButton>
        <AdminButton variant="elevated">Elevated</AdminButton>
        <AdminButton variant="outlined">Outlined</AdminButton>
        <AdminButton variant="text" leadingIcon={<RiArrowRightLine />}>
          Text
        </AdminButton>
        <AdminButton variant="danger" leadingIcon={<RiDeleteBinLine />}>
          Danger
        </AdminButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AdminButton disabled>Disabled</AdminButton>
        <AdminButton loading>Saving</AdminButton>
        <AdminButton variant="outlined" disabled>
          Disabled outline
        </AdminButton>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <AdminButton size="sm">Small</AdminButton>
        <AdminButton size="md">Medium</AdminButton>
        <AdminButton size="lg">Large</AdminButton>
      </div>
    </div>
  ),
};
