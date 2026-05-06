import { RiInboxArchiveLine, RiNotification3Line, RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminBadge } from "./AdminBadge";

const meta: Meta<typeof AdminBadge> = {
  title: "Admin/Primitives/AdminBadge",
  component: AdminBadge,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 notification badge. Dot badges omit text, number badges cap at 99+, and hidden badges render nothing.",
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

function IconTarget({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span
      aria-label={label}
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-[var(--m3-shape-full)] bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface))]"
    >
      {children}
    </span>
  );
}

export const Dot: Story = {
  args: { visible: true },
  render: (args) => (
    <IconTarget label="Notifications">
      <RiNotification3Line className="h-6 w-6" />
      <AdminBadge {...args} className="absolute right-2 top-2" />
    </IconTarget>
  ),
};

export const WithCount: Story = {
  args: { count: 3, visible: true },
  render: (args) => (
    <IconTarget label="Inbox">
      <RiInboxArchiveLine className="h-6 w-6" />
      <AdminBadge {...args} className="absolute right-1.5 top-1.5" />
    </IconTarget>
  ),
};

export const Overflow: Story = {
  args: { count: 142, visible: true },
  render: (args) => (
    <IconTarget label="Members">
      <RiUserLine className="h-6 w-6" />
      <AdminBadge {...args} className="absolute right-0.5 top-1" />
    </IconTarget>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-wrap gap-5">
      <IconTarget label="Dot badge">
        <RiNotification3Line className="h-6 w-6" />
        <AdminBadge className="absolute right-2 top-2" />
      </IconTarget>
      <IconTarget label="Count badge">
        <RiInboxArchiveLine className="h-6 w-6" />
        <AdminBadge count={8} className="absolute right-1.5 top-1.5" />
      </IconTarget>
      <IconTarget label="Overflow badge">
        <RiUserLine className="h-6 w-6" />
        <AdminBadge count={128} className="absolute right-0.5 top-1" />
      </IconTarget>
      <IconTarget label="Hidden badge">
        <RiNotification3Line className="h-6 w-6 opacity-50" />
        <AdminBadge visible={false} className="absolute right-2 top-2" />
      </IconTarget>
    </div>
  ),
};
