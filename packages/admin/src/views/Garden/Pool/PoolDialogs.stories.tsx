import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { PoolDialogs } from "./PoolDialogs";
import { storyPoolConsole } from "./poolStoryFixtures";

const noop = () => undefined;

const meta: Meta<typeof PoolDialogs> = {
  title: "Admin/Pool/PoolDialogs",
  component: PoolDialogs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Every dialog the pool console opens in place: the setup and open flows, the settings sheet, the three reasoned acts, and the three confirmations. Each names the pool it writes to first, and the protocol pool is set apart as a warning.",
      },
    },
  },
  args: {
    pool: storyPoolConsole(),
    target: { gardenName: "Rocinha", isProtocol: false },
    tone: "garden" as const,
    flow: null,
    setFlow: noop,
    settingsOpen: false,
    setSettingsOpen: noop,
    reasonDialog: null,
    setReasonDialog: noop,
    confirmDialog: null,
    setConfirmDialog: noop,
    cycleDialog: null,
    setCycleDialog: noop,
  },
  // The setup flow is always mounted and reads the signed-in steward and the
  // query cache, and its dirty-close guard needs a data router.
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
    withDataRouter("/garden/pool"),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolDialogs>;

export const AllClosed: Story = {};

export const SettingsOpen: Story = { args: { settingsOpen: true } };

/** The protocol pool's settings: the target reads as the protocol's, never a garden's. */
export const ProtocolPoolSettings: Story = {
  args: {
    settingsOpen: true,
    target: { gardenName: "Green Goods Community Garden", isProtocol: true },
  },
};

export const FirstRunSetup: Story = { args: { flow: { intent: "first-run" } } };

export const ClosePoolConfirm: Story = { args: { confirmDialog: "close" } };

export const ArchivePoolConfirm: Story = { args: { confirmDialog: "compost" } };
