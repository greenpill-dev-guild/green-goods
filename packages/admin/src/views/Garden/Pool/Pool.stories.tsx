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
import { GardenPoolTab } from "./index";
import {
  POOL_STORY_SEEDS,
  STORY_CYCLES,
  STORY_GARDEN,
  STORY_PRICE_SEED,
  storyNotReadyPool,
  storyPool,
} from "./poolStoryFixtures";
import {
  nameVoucherMembers,
  STORY_GREEN_GOODS_CLAIMS,
  STORY_GREEN_GOODS_COMMITMENTS,
  STORY_GREEN_GOODS_RETURN_FAILED,
  STORY_TECH_AND_SUN_CLAIMS,
  STORY_TECH_AND_SUN_COMMITMENTS,
  STORY_TECH_AND_SUN_SHORT,
  STORY_TECH_AND_SUN_VOUCHERS,
  STORY_VOUCHER_TITLES,
  voucherConsoleSeed,
} from "./poolStoryVouchers";

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

/** An issuing garden's pool with the voucher pilot read in (PRD-1297 surface 6). */
function voucherSeeds(
  commitments: typeof STORY_TECH_AND_SUN_COMMITMENTS,
  claims: typeof STORY_TECH_AND_SUN_CLAIMS,
  vouchers: Parameters<typeof voucherConsoleSeed>[0]
): ReadonlyArray<readonly [QueryKey, unknown]> {
  return [
    ...STORYBOOK_ADMIN_SHELL_SEEDS,
    STORY_PRICE_SEED,
    [queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_GARDEN), [storyPool()]],
    [queryKeys.commitmentPooling.cycles(DEFAULT_CHAIN_ID, 7n, {}), STORY_CYCLES],
    [
      queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
        chainId: DEFAULT_CHAIN_ID,
        poolId: 7n,
      }),
      commitments,
    ],
    [queryKeys.commitmentPooling.poolClaims(DEFAULT_CHAIN_ID, 7n, "PENDING"), claims],
    ...[...STORY_VOUCHER_TITLES].map(
      ([cid, metadata]) => [queryKeys.commitmentPooling.metadata(cid), metadata] as const
    ),
    voucherConsoleSeed(vouchers),
  ];
}

function decorators(seeds: ReadonlyArray<readonly [QueryKey, unknown]>) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    (Story: ComponentType) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
    withDataRouter("/garden/pool"),
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
          "W7, the steward's pool console over the shared controller. On the left, what needs the steward, the season and its campaigns, and Offers and Requests under Open · Confirmed · Past; on the right, 37.5% of the width, Review Promises, Pool Status and Pool Funding (PRD-1025 D8–D10, named by DL-077). On narrow screens the right column comes last. Seeded through the registry keys the controller reads.",
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
    await expect(await canvas.findByText("Taking promises")).toBeVisible();
  },
};

export const NotReady: Story = {
  decorators: decorators(NOT_READY_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Set Up Promises" })).toBeVisible();
  },
};

export const Unregistered: Story = {
  decorators: decorators(UNREGISTERED_SEEDS),
};

/** A reader who cannot manage the pool: its status and funding, and no acts. */
export const ReaderView: Story = {
  args: { canManage: false },
  decorators: decorators(OPEN_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Pool Funding")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Seed Commitment" })).toBeNull();
  },
};

/**
 * Tech and Sun's Promises console with the voucher pilot read in: two hub days
 * asked in Review Promises (one waits on the Safe's approval, one can be
 * accepted), Mara's visit under way in Offers and Requests, and Tech and Sun's
 * reserve in the rail. Fictional people, working pilot terms.
 */
export const TechAndSunVouchers: Story = {
  args: { garden: { id: STORY_GARDEN, name: "Tech and Sun" } },
  decorators: decorators(
    voucherSeeds(
      STORY_TECH_AND_SUN_COMMITMENTS,
      STORY_TECH_AND_SUN_CLAIMS,
      STORY_TECH_AND_SUN_VOUCHERS
    )
  ),
  beforeEach: nameVoucherMembers,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Your Reserve")).toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Accept…" })).toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Report Visit…" })).toBeVisible();
  },
};

/** Riverside Commons' allowance is used up, so Lina's reward waits beside the asks. */
export const TechAndSunReserveShort: Story = {
  args: TechAndSunVouchers.args,
  decorators: decorators(
    voucherSeeds(
      STORY_TECH_AND_SUN_COMMITMENTS,
      STORY_TECH_AND_SUN_CLAIMS,
      STORY_TECH_AND_SUN_SHORT
    )
  ),
  beforeEach: nameVoucherMembers,
};

/** Green Goods' console: Lina's Claude access returned 6 that didn't arrive, so it needs recovery. */
export const GreenGoodsTransferFailed: Story = {
  args: { garden: { id: STORY_GARDEN, name: "Green Goods Community Garden" } },
  decorators: decorators(
    voucherSeeds(
      STORY_GREEN_GOODS_COMMITMENTS,
      STORY_GREEN_GOODS_CLAIMS,
      STORY_GREEN_GOODS_RETURN_FAILED
    )
  ),
  beforeEach: nameVoucherMembers,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Retry Transfer" })).toBeVisible();
  },
};
