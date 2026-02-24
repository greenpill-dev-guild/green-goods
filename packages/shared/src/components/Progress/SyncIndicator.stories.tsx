import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, fn } from "storybook/test";
import type { QueueStats } from "../../types/job-queue";
import { SyncIndicator } from "./SyncIndicator";

const syncedStats: QueueStats = { total: 5, pending: 0, failed: 0, synced: 5 };
const pendingStats: QueueStats = { total: 8, pending: 3, failed: 0, synced: 5 };
const failedStats: QueueStats = { total: 8, pending: 1, failed: 2, synced: 5 };
const emptyStats: QueueStats = { total: 0, pending: 0, failed: 0, synced: 0 };

const meta: Meta<typeof SyncIndicator> = {
  title: "Progress/SyncIndicator",
  component: SyncIndicator,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Visual indicator for background sync status. Shows pending job count, sync progress animation, online/offline status, and manual sync trigger. Supports compact (icon badge) and full modes.",
      },
    },
  },
  argTypes: {
    stats: {
      control: false,
      description: "Queue statistics from useJobQueue",
    },
    isProcessing: {
      control: "boolean",
      description: "Whether sync is currently in progress",
    },
    onSync: {
      description: "Trigger manual sync",
    },
    isOnline: {
      control: "boolean",
      description: "Whether the device is online",
    },
    compact: {
      control: "boolean",
      description: "Compact mode (icon only)",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SyncIndicator>;

export const Synced: Story = {
  args: {
    stats: syncedStats,
    isProcessing: false,
    isOnline: true,
  },
};

export const Pending: Story = {
  args: {
    stats: pendingStats,
    isProcessing: false,
    isOnline: true,
    onSync: fn(),
  },
};

export const Syncing: Story = {
  args: {
    stats: pendingStats,
    isProcessing: true,
    isOnline: true,
  },
};

export const Offline: Story = {
  args: {
    stats: pendingStats,
    isProcessing: false,
    isOnline: false,
  },
};

export const Error: Story = {
  args: {
    stats: failedStats,
    isProcessing: false,
    isOnline: true,
    onSync: fn(),
  },
};

export const CompactSynced: Story = {
  args: {
    stats: syncedStats,
    isProcessing: false,
    isOnline: true,
    compact: true,
  },
};

export const CompactPending: Story = {
  args: {
    stats: pendingStats,
    isProcessing: false,
    isOnline: true,
    compact: true,
    onSync: fn(),
  },
};

export const CompactSyncing: Story = {
  args: {
    stats: pendingStats,
    isProcessing: true,
    isOnline: true,
    compact: true,
  },
};

export const CompactOffline: Story = {
  args: {
    stats: pendingStats,
    isProcessing: false,
    isOnline: false,
    compact: true,
  },
};

export const CompactError: Story = {
  args: {
    stats: failedStats,
    isProcessing: false,
    isOnline: true,
    compact: true,
    onSync: fn(),
  },
};

export const Empty: Story = {
  args: {
    stats: emptyStats,
    isProcessing: false,
    isOnline: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Returns null when synced and total is 0 (nothing to show).",
      },
    },
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Synced</p>
        <SyncIndicator stats={syncedStats} isProcessing={false} isOnline />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Pending (3 items)</p>
        <SyncIndicator stats={pendingStats} isProcessing={false} isOnline onSync={() => {}} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Syncing</p>
        <SyncIndicator stats={pendingStats} isProcessing isOnline />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Offline</p>
        <SyncIndicator stats={pendingStats} isProcessing={false} isOnline={false} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Error (2 failed)</p>
        <SyncIndicator stats={failedStats} isProcessing={false} isOnline onSync={() => {}} />
      </div>
      <hr className="border-stroke-soft-200" />
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Compact variants</p>
        <div className="flex items-center gap-4">
          <SyncIndicator stats={syncedStats} isProcessing={false} isOnline compact />
          <SyncIndicator
            stats={pendingStats}
            isProcessing={false}
            isOnline
            compact
            onSync={() => {}}
          />
          <SyncIndicator stats={pendingStats} isProcessing isOnline compact />
          <SyncIndicator stats={pendingStats} isProcessing={false} isOnline={false} compact />
          <SyncIndicator
            stats={failedStats}
            isProcessing={false}
            isOnline
            compact
            onSync={() => {}}
          />
        </div>
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    stats: pendingStats,
    isProcessing: false,
    isOnline: true,
    onSync: fn(),
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkModeGallery: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="flex flex-col gap-4 max-w-md">
      <SyncIndicator stats={pendingStats} isProcessing={false} isOnline onSync={() => {}} />
      <SyncIndicator stats={pendingStats} isProcessing isOnline />
      <SyncIndicator stats={pendingStats} isProcessing={false} isOnline={false} />
      <SyncIndicator stats={failedStats} isProcessing={false} isOnline onSync={() => {}} />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    stats: pendingStats,
    isProcessing: false,
    isOnline: true,
    onSync: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify pending status label is shown
    expect(canvas.getByText("Pending")).toBeInTheDocument();

    // Verify pending count text
    expect(canvas.getByText("3 items waiting to sync")).toBeInTheDocument();

    // Click the sync button
    const syncButton = canvas.getByRole("button", { name: "Sync now" });
    expect(syncButton).toBeInTheDocument();
    await userEvent.click(syncButton);
    expect(args.onSync).toHaveBeenCalled();
  },
};
