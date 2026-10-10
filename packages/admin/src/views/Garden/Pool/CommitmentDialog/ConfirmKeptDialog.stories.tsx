import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import { expect, screen } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { STORY_GARDEN, STORY_MARIA, STORY_ROOT_GARDEN } from "../poolStoryFixtures";
import { ConfirmKeptDialog } from "./ConfirmKeptDialog";

// The gardens list names the pool; the protocol registration marks the
// Green Goods Community Garden's own pool apart.
const SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [
    queryKeys.commitmentPooling.protocolPool(DEFAULT_CHAIN_ID),
    { poolId: 1n, rootGarden: STORY_ROOT_GARDEN },
  ],
];

const meta: Meta<typeof ConfirmKeptDialog> = {
  title: "Admin/Pool/ConfirmKeptDialog",
  component: ConfirmKeptDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The review before a commitment is confirmed as kept, shared by Hub → Confirm and the commitment inspector: the commitment, the garden's pool it lives in, who kept it, and whether this confirmation closes it for good. A single confirmation cannot be taken back either, so both cases say so.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    onConfirm: async () => undefined,
    tone: "hub",
    chainId: DEFAULT_CHAIN_ID,
    poolGarden: STORY_GARDEN,
    title: "Repair tool handles",
    keptBy: STORY_MARIA,
    confirmationCount: 1,
    confirmationThreshold: 2,
    isLoading: false,
  },
  decorators: [
    withSeededQueryClient(SEEDS),
    (Story) => (
      <div className="p-4" data-tone="hub">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ConfirmKeptDialog>;

/** The last confirmation needed: it closes the commitment for everyone. */
export const ClosesIt: Story = {
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "Confirm This Commitment Kept" });
    await expect(dialog).toHaveTextContent("“Repair tool handles” in Rio Rainforest Lab’s pool");
    await expect(dialog).toHaveTextContent("This closes the commitment as kept, for everyone.");
  },
};

/** One of several: it counts toward closing, and still cannot be withdrawn. */
export const CountsTowardIt: Story = {
  args: { confirmationCount: 0, confirmationThreshold: 3 },
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "Confirm This Commitment Kept" });
    await expect(dialog).toHaveTextContent(
      "Yours is confirmation 1 of the 3 needed, and it cannot be taken back."
    );
  },
};

/** A commitment in the protocol's own pool is set apart as a warning. */
export const ProtocolPool: Story = {
  args: { poolGarden: STORY_ROOT_GARDEN },
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "Confirm This Commitment Kept" });
    await expect(dialog).toHaveTextContent("Writing to the Green Goods protocol pool");
  },
};

/** While the confirmation is on its way the dialog holds still. */
export const Sending: Story = {
  args: { isLoading: true },
};
