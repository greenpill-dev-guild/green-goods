import type { Meta, StoryObj } from "@storybook/react";
import { PoolSettingsDialog } from "./PoolSettingsDialog";
import { storyPoolConsole } from "./poolStoryFixtures";

const meta: Meta<typeof PoolSettingsDialog> = {
  title: "Admin/Pool/PoolSettingsDialog",
  component: PoolSettingsDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Edit pool settings: the charter sentence and the per-person commitment limit. Both stay editable for the pool's whole life; changing the limit never affects commitments already made.",
      },
    },
  },
  args: { open: true, onClose: () => undefined },
};

export default meta;
type Story = StoryObj<typeof PoolSettingsDialog>;

export const Default: Story = { args: { console: storyPoolConsole() } };

export const Offline: Story = { args: { console: storyPoolConsole({ isOnline: false }) } };
