import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "Primitives/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: [
        "approved",
        "rejected",
        "pending",
        "syncing",
        "sync_failed",
        "uploading",
        "offline",
      ],
      description: "Work status to display",
    },
    size: {
      control: "select",
      options: ["sm", "md"],
      description: "Size of the badge",
    },
    showIcon: {
      control: "boolean",
      description: "Whether to show the status icon",
    },
    variant: {
      control: "select",
      options: ["default", "semantic"],
      description: "Color variant style",
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Approved: Story = {
  args: {
    status: "approved",
    showIcon: true,
    size: "md",
  },
};

export const Rejected: Story = {
  args: {
    status: "rejected",
    showIcon: true,
    size: "md",
  },
};

export const Pending: Story = {
  args: {
    status: "pending",
    showIcon: true,
    size: "md",
  },
};

export const Syncing: Story = {
  args: {
    status: "syncing",
    showIcon: true,
    size: "md",
  },
};

export const Failed: Story = {
  args: {
    status: "sync_failed",
    showIcon: true,
    size: "md",
  },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="approved" />
      <StatusBadge status="rejected" />
      <StatusBadge status="pending" />
      <StatusBadge status="syncing" />
      <StatusBadge status="sync_failed" />
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="approved" size="sm" />
      <StatusBadge status="rejected" size="sm" />
      <StatusBadge status="pending" size="sm" />
    </div>
  ),
};

export const WithoutIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="approved" showIcon={false} />
      <StatusBadge status="rejected" showIcon={false} />
      <StatusBadge status="pending" showIcon={false} />
    </div>
  ),
};

export const SemanticVariant: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="approved" variant="semantic" />
      <StatusBadge status="rejected" variant="semantic" />
      <StatusBadge status="pending" variant="semantic" />
    </div>
  ),
};

export const DarkMode: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="approved" />
      <StatusBadge status="rejected" />
      <StatusBadge status="pending" />
      <StatusBadge status="syncing" />
      <StatusBadge status="sync_failed" />
    </div>
  ),
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
