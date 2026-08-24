import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { GardenPoolTab } from "./index";
import { POOL_STORY_SEEDS, STORY_GARDEN, storyNotReadyPool } from "./poolStoryFixtures";

const OPEN_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
];

const NOT_READY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_GARDEN), [storyNotReadyPool()]],
  [queryKeys.commitmentPooling.cycles(DEFAULT_CHAIN_ID, 7n, {}), []],
  [
    queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
      chainId: DEFAULT_CHAIN_ID,
      poolId: 7n,
    }),
    [],
  ],
  [queryKeys.commitmentPooling.poolClaims(DEFAULT_CHAIN_ID, 7n, "PENDING"), []],
];

const UNREGISTERED_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_GARDEN), []],
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
              path: "/garden/pool",
              element: (
                <div className="p-4" data-tone="garden">
                  <Story />
                </div>
              ),
            },
          ],
          { initialEntries: ["/garden/pool"] }
        )}
      />
    ),
  ];
}

const meta: Meta<typeof GardenPoolTab> = {
  title: "Admin/Pool/GardenPoolTab",
  component: GardenPoolTab,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "W7, the steward's pool console over the shared controller: the season and its campaigns, the claims waiting, the commitments under Open · Confirmed · Past, and the pool's own status card. Seeded through the registry keys the controller reads.",
      },
    },
  },
  args: {
    garden: { id: STORY_GARDEN, name: "Rio Rainforest Lab" },
    chainId: DEFAULT_CHAIN_ID,
    canManage: true,
  },
};

export default meta;
type Story = StoryObj<typeof GardenPoolTab>;

export const Open: Story = {
  decorators: decorators(OPEN_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Season of First Rains")).toBeVisible();
    await expect(await canvas.findByText("Taking commitments")).toBeVisible();
  },
};

export const NotReady: Story = {
  decorators: decorators(NOT_READY_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Set up commitments" })).toBeVisible();
  },
};

export const Unregistered: Story = {
  decorators: decorators(UNREGISTERED_SEEDS),
};
