import type { Meta, StoryObj } from "@storybook/react";
import { SyncStatusBar } from "./SyncStatusBar";

/**
 * TODO: SyncStatusBar relies heavily on internal hooks:
 * - useOffline (online/offline detection)
 * - usePendingWorksCount (IndexedDB query)
 * - useUIStore (offline banner visibility)
 *
 * Full interaction stories require mocking these hooks.
 * For now, stories render the component which returns null
 * when isOfflineBannerVisible is false or pendingCount is 0
 * (the default Storybook state).
 */

const meta: Meta<typeof SyncStatusBar> = {
  title: "Shared/Progress/SyncStatusBar",
  component: SyncStatusBar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Persistent bar above the app navigation while queued work waits on this device. Shows how much waits to upload, or that it is saved while offline, and offers Review uploads, which opens Your Work where Upload all sends it. Requires offline and queue context to render.",
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
