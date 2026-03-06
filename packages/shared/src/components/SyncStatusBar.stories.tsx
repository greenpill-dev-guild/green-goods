import type { Meta, StoryObj } from "@storybook/react";
import { SyncStatusBar } from "./SyncStatusBar";

/**
 * TODO: SyncStatusBar relies heavily on internal hooks:
 * - useAuth (wallet/passkey auth mode)
 * - useOffline (online/offline detection)
 * - usePendingWorksCount (IndexedDB query)
 * - useBatchWorkSync (mutation)
 * - useQueueFlush (job queue provider)
 * - useUIStore (offline banner visibility)
 *
 * Full interaction stories require mocking these hooks.
 * For now, stories render the component which returns null
 * when isOfflineBannerVisible is false or pendingCount is 0
 * (the default Storybook state).
 *
 * Prefer using SyncIndicator stories for visual testing of
 * sync status UI since it accepts props directly.
 */

const meta: Meta<typeof SyncStatusBar> = {
  title: "Progress/SyncStatusBar",
  component: SyncStatusBar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Persistent queue sync status bar shown above the app navigation. Displays pending work count, offline status, and sync-all action for wallet users. Requires auth, offline, and queue context to render.",
      },
    },
  },
  argTypes: {
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SyncStatusBar>;

/**
 * Default state: renders null because the underlying hooks return
 * default values (not offline, no pending works, banner not visible).
 * See SyncIndicator stories for interactive sync status UI.
 */
export const Default: Story = {
  args: {},
};

export const DarkMode: Story = {
  args: {},
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
