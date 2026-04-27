import { RiAddLine, RiEditLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminFab } from "./AdminFab";

const meta: Meta<typeof AdminFab> = {
  title: "Admin/Primitives/AdminFab",
  component: AdminFab,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 floating action button with small, standard, large, and extended forms. Uses primary-container color, M3 shapes, and elevation.",
      },
    },
  },
  argTypes: {
    size: { control: "select", options: ["small", "standard", "large"] },
    extended: { control: "boolean" },
    label: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminFab>;

export const Standard: Story = {
  args: {
    icon: RiAddLine,
    label: "Create action",
    size: "standard",
    onClick: () => {},
  },
};

export const Small: Story = {
  args: { icon: RiAddLine, label: "Create action", size: "small", onClick: () => {} },
};

export const Large: Story = {
  args: { icon: RiAddLine, label: "Create action", size: "large", onClick: () => {} },
};

export const Extended: Story = {
  args: {
    icon: RiEditLine,
    label: "New action",
    extended: true,
    onClick: () => {},
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-5">
      <AdminFab icon={RiAddLine} label="Create action" size="small" onClick={() => {}} />
      <AdminFab icon={RiAddLine} label="Create action" size="standard" onClick={() => {}} />
      <AdminFab icon={RiAddLine} label="Create action" size="large" onClick={() => {}} />
      <AdminFab icon={RiEditLine} label="Submit work" extended onClick={() => {}} />
    </div>
  ),
};
