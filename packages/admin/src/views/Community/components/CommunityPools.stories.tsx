import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import {
  POOL_STORY_SEEDS,
  STORY_GARDEN,
  STORY_ROOT_GARDEN,
  storyPool,
} from "../../Garden/Pool/poolStoryFixtures";
import { CommunityPools } from "./CommunityPools";

const PROTOCOL_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
  [
    queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID),
    [
      storyPool({
        id: `${DEFAULT_CHAIN_ID}-1`,
        poolId: 1n,
        poolType: "PROTOCOL",
        garden: STORY_ROOT_GARDEN,
        gardenId: STORY_ROOT_GARDEN,
      }),
      storyPool(),
    ],
  ],
  [
    queryKeys.commitmentPooling.protocolPool(DEFAULT_CHAIN_ID),
    { poolId: 1n, rootGarden: STORY_ROOT_GARDEN },
  ],
  [
    queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_ROOT_GARDEN),
    [
      storyPool({
        id: `${DEFAULT_CHAIN_ID}-1`,
        poolId: 1n,
        poolType: "PROTOCOL",
        garden: STORY_ROOT_GARDEN,
        gardenId: STORY_ROOT_GARDEN,
      }),
    ],
  ],
  [queryKeys.commitmentPooling.cycles(DEFAULT_CHAIN_ID, 1n, {}), []],
  [
    queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
      chainId: DEFAULT_CHAIN_ID,
      poolId: 1n,
    }),
    [],
  ],
  [queryKeys.commitmentPooling.poolClaims(DEFAULT_CHAIN_ID, 1n, "PENDING"), []],
];

// The root garden is named on chain, but no protocol pool is registered for it.
const UNREGISTERED_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
  [
    queryKeys.commitmentPooling.protocolPool(DEFAULT_CHAIN_ID),
    { poolId: null, rootGarden: STORY_ROOT_GARDEN },
  ],
  [queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_ROOT_GARDEN), []],
];

const ROOT_GARDEN = { id: STORY_ROOT_GARDEN, name: "Green Goods Community Garden" };

function decorators(seeds: ReadonlyArray<readonly [QueryKey, unknown]>) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    (Story: ComponentType) => (
      <div className="p-4" data-tone="community">
        <Story />
      </div>
    ),
    withDataRouter("/community/pools"),
  ];
}

const meta: Meta<typeof CommunityPools> = {
  title: "Admin/Community/CommunityPools",
  component: CommunityPools,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Community → Coordination's pooling section speaks only for the garden in the header: its pool, one tap from the console in the Garden workspace. The protocol's own operations (settlement, protocol funding, protocol confirmations) appear only when that garden is the Green Goods Community Garden, so no other garden can reach the protocol pool.",
      },
    },
  },
  args: {
    chainId: DEFAULT_CHAIN_ID,
    garden: { id: STORY_GARDEN, name: "Rio Rainforest Lab" },
    canManage: true,
  },
};

export default meta;
type Story = StoryObj<typeof CommunityPools>;

/** An ordinary garden: its own pool, and nothing of the protocol's. */
export const OrdinaryGarden: Story = {
  decorators: decorators(PROTOCOL_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Open the Pool Console" })
    ).toBeVisible();
    await expect(canvas.queryByTestId("protocol-pool")).toBeNull();
    await expect(canvas.queryByRole("tab")).toBeNull();
  },
};

/**
 * The Green Goods Community Garden: its pool is the protocol's, so the
 * protocol's operations section mounts here and nowhere else. Settlement,
 * protocol funding, and protocol confirmations each fill in only for someone
 * who holds that authority; this story's reader holds none, so the section is
 * present and empty (the steward views are covered by the unit tests).
 */
export const ProtocolGarden: Story = {
  args: { garden: ROOT_GARDEN },
  decorators: decorators(PROTOCOL_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId("protocol-pool")).toBeInTheDocument();
    await expect(
      await canvas.findByRole("button", { name: "Open the Pool Console" })
    ).toBeVisible();
  },
};

/** The root garden, before a protocol pool is registered for it. */
export const NoProtocolPool: Story = {
  args: { garden: ROOT_GARDEN },
  decorators: decorators(UNREGISTERED_SEEDS),
};
