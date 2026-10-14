import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "Shared/Primitives/StatusBadge",
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
      options: ["xs", "sm", "md"],
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

/**
 * `xs` is the 12px pill for dense rows and cards (a promise row, a season card),
 * 22px tall, where it sits beside 12px words; the status block of a page keeps
 * `sm` or `md`.
 */
export const Sizes: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge variant="success" size="xs" showIcon={false}>
        Open
      </StatusBadge>
      <StatusBadge variant="success" size="sm" showIcon={false}>
        Open
      </StatusBadge>
      <StatusBadge variant="success" size="md" showIcon={false}>
        Open
      </StatusBadge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = within(canvasElement).getAllByRole("status");
    const measure = (badge: HTMLElement) => ({
      fontSize: getComputedStyle(badge).fontSize,
      height: badge.getBoundingClientRect().height,
    });
    await expect(badges.map(measure)).toEqual([
      { fontSize: "12px", height: 22 },
      { fontSize: "14px", height: 26 },
      { fontSize: "16px", height: 30 },
    ]);
  },
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

export const AdminTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge variant="success" size="sm">
        Deployed
      </StatusBadge>
      <StatusBadge variant="warning" size="sm">
        Pending review
      </StatusBadge>
      <StatusBadge variant="error" size="sm">
        Not deployed
      </StatusBadge>
      <StatusBadge variant="info" size="sm">
        Syncing
      </StatusBadge>
      <StatusBadge variant="neutral" size="sm">
        Draft
      </StatusBadge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Generic icon + text + color badges for admin operational states. Use these for contract, deployment, and workspace status instead of color-only pills.",
      },
    },
  },
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
