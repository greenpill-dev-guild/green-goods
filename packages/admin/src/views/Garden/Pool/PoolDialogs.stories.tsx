import type { Meta, StoryObj } from "@storybook/react";
import { PoolDialogs } from "./PoolDialogs";
import { STORY_GARDEN, storyPoolConsole } from "./poolStoryFixtures";

const noop = () => undefined;

const meta: Meta<typeof PoolDialogs> = {
  title: "Admin/Pool/PoolDialogs",
  component: PoolDialogs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Every dialog the pool console can open, in one place: the setup and open flows, the settings sheet, the seeding console and the commitment inspector, the three reasoned acts, and the three confirmations that carry zero-count facts rather than a reason.",
      },
    },
  },
  args: {
    pool: storyPoolConsole(),
    garden: { id: STORY_GARDEN, name: "Rocinha" },
    chainId: 42161,
    tone: "garden" as const,
    presentation: { inspector: "route" as const },
    flow: null,
    setFlow: noop,
    settingsOpen: false,
    setSettingsOpen: noop,
    seedOpen: false,
    setSeedOpen: noop,
    inspected: null,
    setInspected: noop,
    reasonDialog: null,
    setReasonDialog: noop,
    confirmDialog: null,
    setConfirmDialog: noop,
  },
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolDialogs>;

export const AllClosed: Story = {};

export const SettingsOpen: Story = { args: { settingsOpen: true } };

export const FirstRunSetup: Story = { args: { flow: { intent: "first-run" } } };

export const ClosePoolConfirm: Story = { args: { confirmDialog: "close" } };

export const ArchivePoolConfirm: Story = { args: { confirmDialog: "compost" } };
