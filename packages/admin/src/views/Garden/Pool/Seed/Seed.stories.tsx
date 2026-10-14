import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { POOL_STORY_SEEDS, STORY_GARDEN, storyPool } from "../poolStoryFixtures";
import { SeedCommitmentDialog } from "./index";

// The seeding console reads the pool through the shared controllers; the
// cache carries the pool, its cycles, the (unregistered) protocol pool and the
// pool's open-commitment counts (nobody holds any yet) so the real component
// renders without an indexer or a chain.
const SEED_STORY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
  [
    queryKeys.commitmentPooling.pool(DEFAULT_CHAIN_ID, 7n),
    { pool: storyPool(), unitSummaries: [], providerExposures: [] },
  ],
  [queryKeys.commitmentPooling.protocolPool(DEFAULT_CHAIN_ID), { poolId: null, rootGarden: null }],
  [
    queryKeys.commitmentPooling.settlementAccount(DEFAULT_CHAIN_ID, STORY_GARDEN),
    { account: null, route: null },
  ],
];

const meta: Meta<typeof SeedCommitmentDialog> = {
  title: "Admin/Pool/SeedCommitmentDialog",
  component: SeedCommitmentDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seed Promises (PRD-1022 screens 01–12), the steward's seeding flow over the member composer's shared form: What → How Much → Proof & Confirmation → a sectioned Review. One answer can create up to fifty separate promises, each taken up, proven and confirmed on its own, shown as one group. A wallet that can bundle is asked once per ten; any other once per promise, with Try Again for what didn't send. From the Review, Add Another Like This keeps the answer and starts the next from the same one.",
      },
    },
  },
  args: { open: true, chainId: DEFAULT_CHAIN_ID, garden: STORY_GARDEN, onClose: () => undefined },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(SEED_STORY_SEEDS),
    withDataRouter("/garden/pool/seed"),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedCommitmentDialog>;

export const What: Story = {
  play: async () => {
    const dialog = within(document.body);
    await expect(await dialog.findByRole("heading", { name: "What" })).toBeVisible();
    await expect(dialog.getByLabelText("Cycle")).toHaveValue("12");
  },
};

/**
 * Seeding into the protocol pool: requests default to steward review because
 * the pool itself is the protocol's, wherever the wizard was opened from.
 */
export const ProtocolContext: Story = {
  decorators: [
    withSeededQueryClient([
      ...SEED_STORY_SEEDS,
      [
        queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_GARDEN),
        [storyPool({ poolType: "PROTOCOL" })],
      ],
      [
        queryKeys.commitmentPooling.pool(DEFAULT_CHAIN_ID, 7n),
        { pool: storyPool({ poolType: "PROTOCOL" }), unitSummaries: [], providerExposures: [] },
      ],
    ]),
  ],
};
