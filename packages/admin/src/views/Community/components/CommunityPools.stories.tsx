import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, userEvent, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
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

const UNREGISTERED_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
  [queryKeys.commitmentPooling.protocolPool(DEFAULT_CHAIN_ID), { poolId: null, rootGarden: null }],
];

function decorators(seeds: ReadonlyArray<readonly [QueryKey, unknown]>) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    (Story: ComponentType) => (
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              path: "/community/pools",
              element: (
                <div className="p-4" data-tone="community">
                  <Story />
                </div>
              ),
            },
          ],
          { initialEntries: ["/community/pools"] }
        )}
      />
    ),
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
          "W12, Community → Pools: exactly the protocol pool and this garden's pool. The Protocol pool tab hosts the root garden's console in protocol context; This garden is one tap into the pool console.",
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

export const ProtocolPool: Story = {
  decorators: decorators(PROTOCOL_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tab", { name: "Protocol pool" })).toBeVisible();
  },
};

export const CurrentGarden: Story = {
  decorators: decorators(PROTOCOL_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("tab", { name: "This garden" }));
    await expect(
      await canvas.findByRole("button", { name: "Open the Pool Console" })
    ).toBeVisible();
  },
};

export const NoProtocolPool: Story = {
  decorators: decorators(UNREGISTERED_SEEDS),
};
