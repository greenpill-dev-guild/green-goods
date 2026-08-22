import { DEFAULT_CHAIN_ID, queryKeys } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { SeedCommitmentDialog } from "./index";
import { POOL_STORY_SEEDS, STORY_GARDEN } from "../poolStoryFixtures";

// The seeding console reads the pool through the shared controllers; the
// cache carries the pool, its cycles and the (unregistered) protocol pool so
// the real component renders without an indexer or a chain.
const SEED_STORY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
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
          "W8, the steward's seeding console: a cast of the member composer over the same shared form, with the steward's extras. What → how much → proof & confirmation → sectioned review, then one queued creation.",
      },
    },
  },
  args: { open: true, chainId: DEFAULT_CHAIN_ID, garden: STORY_GARDEN, onClose: () => undefined },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(SEED_STORY_SEEDS),
    (Story) => (
      <RouterProvider
        router={createMemoryRouter([{ path: "/garden/pool/seed", element: <Story /> }], {
          initialEntries: ["/garden/pool/seed"],
        })}
      />
    ),
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

export const ProtocolContext: Story = {
  args: { protocolContext: true },
};
