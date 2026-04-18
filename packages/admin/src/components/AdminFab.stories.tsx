import type { Meta, StoryObj } from "@storybook/react";
import { RiAddLine, RiEditLine } from "@remixicon/react";
import { AdminFab } from "./AdminFab";

const meta: Meta<typeof AdminFab> = {
  title: "Admin/AdminFab",
  component: AdminFab,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Floating Action Button with small (40dp), standard (56dp, default), and large (96dp) sizes. When a label is provided, renders as an extended FAB with icon + label.",
      },
    },
  },
  argTypes: {
    size: { control: "select", options: ["small", "standard", "large"] },
    label: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminFab>;

export const Standard: Story = {
  args: {
    icon: RiAddLine,
    size: "standard",
    onClick: () => {},
  },
};

export const Small: Story = {
  args: { icon: RiAddLine, size: "small", onClick: () => {} },
};

export const Large: Story = {
  args: { icon: RiAddLine, size: "large", onClick: () => {} },
};

export const Extended: Story = {
  args: {
    icon: RiEditLine,
    label: "New action",
    onClick: () => {},
  },
};

export const SizeGallery: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <AdminFab icon={RiAddLine} size="small" onClick={() => {}} />
      <AdminFab icon={RiAddLine} size="standard" onClick={() => {}} />
      <AdminFab icon={RiAddLine} size="large" onClick={() => {}} />
      <AdminFab icon={RiEditLine} label="Submit" onClick={() => {}} />
    </div>
  ),
};
