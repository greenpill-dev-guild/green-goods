import type { Meta, StoryObj } from "@storybook/react";
import { RiNotification3Line } from "@remixicon/react";
import { AdminBadge } from "./AdminBadge";

const meta: Meta<typeof AdminBadge> = {
  title: "Admin/Primitives/AdminBadge",
  component: AdminBadge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Notification Badge. Small (dot) when count is undefined, large (number) when count is provided. 99+ cap on large. Renders nothing when visible is false.",
      },
    },
  },
  argTypes: {
    count: { control: "number" },
    visible: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminBadge>;

export const Dot: Story = {
  args: { visible: true },
  render: (args) => (
    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--m3-surface-container-high))]">
      <RiNotification3Line className="h-5 w-5 text-[rgb(var(--m3-on-surface))]" />
      <AdminBadge {...args} className="absolute right-1.5 top-1.5" />
    </span>
  ),
};

export const WithCount: Story = {
  args: { count: 3, visible: true },
  render: (args) => (
    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--m3-surface-container-high))]">
      <RiNotification3Line className="h-5 w-5 text-[rgb(var(--m3-on-surface))]" />
      <AdminBadge {...args} className="absolute right-1 top-1" />
    </span>
  ),
};

export const Overflow: Story = {
  args: { count: 142, visible: true },
  render: (args) => (
    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--m3-surface-container-high))]">
      <RiNotification3Line className="h-5 w-5 text-[rgb(var(--m3-on-surface))]" />
      <AdminBadge {...args} className="absolute right-0 top-0.5" />
    </span>
  ),
};
