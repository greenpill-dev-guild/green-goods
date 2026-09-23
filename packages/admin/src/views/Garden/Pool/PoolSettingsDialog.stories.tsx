import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
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
          "Edit pool settings: the agreement and the per-person commitment limit. Only what changed is written, the agreement first, through the setup sequence: the dialog says how many times the wallet will ask, shows each write landing, names what was saved if a write stops, and ends on a done state. The running, stopped and done states are in PoolSettingsProgress.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    target: { gardenName: "Rocinha", isProtocol: false },
  },
  // The save runs through the setup sequence (the signed-in steward and the
  // query cache), and the dirty-close guard needs a data router.
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withDataRouter("/garden/pool"),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolSettingsDialog>;

export const Default: Story = { args: { console: storyPoolConsole() } };

/** Both settings changed: the dialog says how many prompts the save takes. */
export const BothChanged: Story = {
  args: { console: storyPoolConsole() },
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "Pool settings" });
    const purpose = await screen.findByLabelText(/what this pool is for/i);
    await userEvent.clear(purpose);
    await userEvent.type(purpose, "Keep the tool library lending all year.");
    const cap = screen.getByLabelText(/how many commitments one person can hold/i);
    await userEvent.clear(cap);
    await userEvent.type(cap, "12");
    await expect(dialog).toHaveTextContent(/your wallet will ask you/i);
  },
};

export const Offline: Story = { args: { console: storyPoolConsole({ isOnline: false }) } };

/** Editing the protocol pool: the dialog says so before anything else. */
export const ProtocolPool: Story = {
  args: {
    console: storyPoolConsole(),
    target: { gardenName: "Green Goods Community Garden", isProtocol: true },
  },
};
