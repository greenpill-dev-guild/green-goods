import type { Meta, StoryObj } from "@storybook/react";
import { SyncStatusBarWalletActionView } from "./SyncStatusBarWalletAction";

const meta = {
  title: "Shared/Progress/SyncStatusBarWalletAction",
  component: SyncStatusBarWalletActionView,
  tags: ["autodocs"],
  args: {
    isOnline: true,
    isPending: false,
    pendingCount: 3,
    onSync: () => {},
  },
} satisfies Meta<typeof SyncStatusBarWalletActionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Offline: Story = {
  args: { isOnline: false },
};

export const Sending: Story = {
  args: { isPending: true },
};
