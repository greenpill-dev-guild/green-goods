import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";
import { useSettlementOperationsController } from "@green-goods/shared/hooks/admin-ui/pool/useSettlementOperationsController";
import { useProtocolFundingOperationsController } from "@green-goods/shared/hooks/admin-ui/pool/useProtocolFundingOperationsController";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_ADMIN_VAULTS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import {
  storyProtocolFundingOperations,
  storySettlementOperations,
} from "../Garden/Pool/poolStorySettlement";
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../storybookCanvasHarness";
import type { QueryKey } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import {
  POOL_STORY_SEEDS,
  STORY_GARDEN,
  STORY_ROOT_GARDEN,
  STORY_STEWARD,
  storyPool,
} from "../Garden/Pool/poolStoryFixtures";
import {
  expectAdminShellDarkPalette,
  expectAllVisibleSelectorContrast,
  withTemporaryDocumentTheme,
} from "../storybookPaletteAssertions";

interface CommunityCanvasStoryProps {
  initialPath?: string;
}

function CommunityCanvasStory({ initialPath = "/community/endowment" }: CommunityCanvasStoryProps) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
}

const meta: Meta<typeof CommunityCanvasStory> = {
  title: "Admin/Workspaces/Community",
  component: CommunityCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seeded Community workspace coverage through the real CanvasLayout shell, including the Members, Endowment, and Payouts tabs, plus legacy coordination routes and route-backed detail entry points.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommunityCanvasStory>;

function communityDecorators(
  seeds: ReadonlyArray<readonly [QueryKey, unknown]> = STORYBOOK_ADMIN_SHELL_SEEDS
) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "community",
    }),
  ];
}

// Coordination with the folded W12 pooling surface seeded (2026-08-25 AD-5):
// the protocol pool and this garden's pool render beneath the governance grid.
export const CoordinationWithPooling: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/coordination" },
  decorators: communityDecorators([...STORYBOOK_ADMIN_SHELL_SEEDS, ...POOL_STORY_SEEDS]),
};

const protocolGarden = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  id: STORY_ROOT_GARDEN,
  name: "Green Goods Community Garden",
};

const protocolConfirmationSeeds: ReadonlyArray<readonly [QueryKey, unknown]> = [
  [
    queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
      chainId: DEFAULT_CHAIN_ID,
      account: STORY_STEWARD,
    }),
    [],
  ],
  [
    queryKeys.commitmentPooling.activity(DEFAULT_CHAIN_ID, {
      actor: STORY_STEWARD,
      eventType: "CONFIRMATION_RECORDED",
    }),
    [],
  ],
  ...[STORY_ROOT_GARDEN, STORY_GARDEN].flatMap((garden) => [
    [
      queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
        chainId: DEFAULT_CHAIN_ID,
        account: garden,
        state: "READY_FOR_CONFIRMATION",
      }),
      [],
    ] as const,
    [
      queryKeys.commitmentPooling.fallbackCandidates(DEFAULT_CHAIN_ID, {
        chainId: DEFAULT_CHAIN_ID,
        garden,
      }),
      [],
    ] as const,
  ]),
  [
    queryKeys.commitmentPooling.fallbackCandidates(DEFAULT_CHAIN_ID, {
      protocolFallbackEnabled: true,
    }),
    [],
  ],
  ...[1n, storyPool().poolId].map(
    (poolId) =>
      [
        queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
          chainId: DEFAULT_CHAIN_ID,
          poolId,
          state: "DISPUTED",
        }),
        [],
      ] as const
  ),
];

export const ProtocolCoordination: Story = {
  tags: ["visual-harness"],
  beforeEach: () => {
    mocked(useProtocolFundingOperationsController).mockImplementation((input) =>
      storyProtocolFundingOperations({
        protocolGarden: input.protocolGarden,
        targetGarden: input.targetGarden,
        targetFunding: input.targetGarden
          ? storyProtocolFundingOperations().targetFunding
          : { ...storyProtocolFundingOperations().targetFunding, snapshot: null },
        rows: storyProtocolFundingOperations().rows.map((row) => ({
          ...row,
          garden: STORY_GARDEN,
        })),
      })
    );
    mocked(useSettlementOperationsController).mockReturnValue(storySettlementOperations());
    return resetHookMocks(
      useProtocolFundingOperationsController,
      useSettlementOperationsController
    );
  },
  args: { initialPath: `/community/coordination?gardenId=${STORY_ROOT_GARDEN}` },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient([
      ...protocolConfirmationSeeds,
      ...STORYBOOK_ADMIN_SHELL_SEEDS,
      ...POOL_STORY_SEEDS,
      [
        queryKeys.gardens.byChain(DEFAULT_CHAIN_ID),
        [protocolGarden, STORYBOOK_PRIMARY_ADMIN_GARDEN],
      ],
      [
        queryKeys.role.stewardGardens(
          STORY_STEWARD.toLowerCase() as typeof STORY_ROOT_GARDEN,
          DEFAULT_CHAIN_ID
        ),
        [{ id: protocolGarden.id, name: protocolGarden.name }],
      ],
      [queryKeys.works.merged(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID), []],
      [queryKeys.assessments.byGardenBase(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID), []],
      [queryKeys.hypercerts.list(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID, undefined), []],
      [queryKeys.vaults.byGarden(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID), []],
      [queryKeys.yield.allocations(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID, 20), []],
      [queryKeys.community.garden(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID), null],
      [queryKeys.community.pools(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID), []],
      [queryKeys.conviction.strategies(STORY_ROOT_GARDEN, DEFAULT_CHAIN_ID), []],
      [
        queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID),
        [
          storyPool({
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
            poolId: 1n,
            poolType: "PROTOCOL",
            garden: STORY_ROOT_GARDEN,
            gardenId: STORY_ROOT_GARDEN,
          }),
        ],
      ],
    ]),
    withSelectedAdminGarden(protocolGarden),
    withCanvasFrame({ className: "p-0", heightClassName: "h-[760px]", workspace: "community" }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tab = await canvas.findByRole(
      "tab",
      { name: "Coordination" },
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(
      await canvas.findByTestId("protocol-pool", {}, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Receiving garden" }),
      STORY_GARDEN
    );
    await expect(canvas.getByRole("button", { name: "Review Seed or Top-Up…" })).toBeEnabled();
    expect(canvas.getByRole("heading", { name: "Fund a Garden" }).closest("aside")).not.toBeNull();
    expect(
      canvas
        .getByRole("heading", { name: "Protocol-to-Garden Transfers" })
        .closest(".garden-tab-main")
    ).not.toBeNull();
    expect(
      canvas.getByRole("heading", { name: "Protocol Confirmations" }).closest(".garden-tab-main")
    ).not.toBeNull();
  },
};

export const MembersFillCanvas: Story = {
  args: { initialPath: `/community/members?gardenId=${STORYBOOK_PRIMARY_ADMIN_GARDEN.id}` },
  decorators: communityDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Member directory" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    if (window.matchMedia("(min-width: 1024px)").matches) {
      await waitFor(() => {
        const card = canvasElement.querySelector(
          ".garden-tab-main > [data-component='AdminCard']"
        )!;
        const frame = canvasElement.querySelector(".canvas-route-card")!;
        const contentBottom =
          frame.getBoundingClientRect().bottom -
          Number.parseFloat(getComputedStyle(frame).paddingBottom);
        expect(Math.abs(card.getBoundingClientRect().bottom - contentBottom)).toBeLessThan(2);
      });
    }
  },
};

export const Endowment: Story = {
  // Not in storybook-ci: the endowment play needs live indexer/vault + analytics data the
  // clean-room CI browser can't reach (getGardenVaults / Analytics SDK "Failed to fetch"),
  // so the garden name never renders offline. Kept for local/authenticated Storybook review.
  args: { initialPath: `/community/endowment?gardenId=${STORYBOOK_PRIMARY_ADMIN_GARDEN.id}` },
  decorators: communityDecorators([
    ...STORYBOOK_ADMIN_SHELL_SEEDS,
    [
      queryKeys.vaults.byGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN.id, DEFAULT_CHAIN_ID),
      STORYBOOK_ADMIN_VAULTS.map((vault) => ({
        ...vault,
        asset: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as const,
      })),
    ],
  ]),
  play: async ({ canvasElement }) => {
    await withTemporaryDocumentTheme("dark", async () => {
      const canvas = within(canvasElement);
      await expect(
        await canvas.findByRole("heading", { name: "Community" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
      ).toBeVisible();
      const tabs = within(canvas.getByRole("tablist", { name: "Community views" }));
      await expect(tabs.getAllByRole("tab")).toHaveLength(3);
      await expect(tabs.queryByRole("tab", { name: "Coordination" })).not.toBeInTheDocument();
      await expect(
        (
          await canvas.findAllByText(
            "Rio Rainforest Lab",
            undefined,
            ADMIN_ROUTE_STORY_QUERY_OPTIONS
          )
        ).length
      ).toBeGreaterThan(0);
      await waitFor(() => expectAdminShellDarkPalette(canvasElement));
      await waitFor(() =>
        expectAllVisibleSelectorContrast(canvasElement, ".text-primary-base", {
          label: "Community primary action links",
        })
      );
      await waitFor(() =>
        expectAllVisibleSelectorContrast(canvasElement, ".bg-success-lighter .text-success-dark", {
          label: "Community success status text",
        })
      );
    });
  },
};

export const VaultInspector: Story = {
  // Not in storybook-ci: the vault inspector needs live indexer/vault data the clean-room
  // CI browser can't reach, so it renders empty offline. Kept for local/authenticated
  // Storybook review.
  args: { initialPath: "/community/endowment/vault" },
  decorators: communityDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      await canvas.findByRole(
        "button",
        { name: /Rio Rainforest Lab/ },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    // Left/bottom canvas sheets are retired — the inspector now renders as an
    // AdminDialog portaled to document.body (role="dialog").
    const body = within(document.body);
    const inspector = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(inspector).toHaveAttribute("data-component", "AdminDialog");
    await expect(
      await within(inspector).findByText(
        "Total value locked",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    await expect(
      await within(inspector).findByText(
        "Net deposited",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    await expect(
      (
        await within(inspector).findAllByText(
          "Depositors",
          undefined,
          ADMIN_ROUTE_STORY_QUERY_OPTIONS
        )
      ).length
    ).toBeGreaterThan(0);
  },
};

export const CoordinationPools: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/coordination" },
  decorators: communityDecorators(),
};

export const CoordinationStrategiesInspector: Story = {
  args: { initialPath: "/community/coordination/strategies" },
  decorators: communityDecorators(),
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    await expect(
      await body.findByRole(
        "button",
        { name: /Rio Rainforest Lab/ },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const SignalPoolInspector: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/coordination/signal-pool/action" },
  decorators: communityDecorators(),
};

export const YieldPayouts: Story = {
  tags: ["visual-harness"],
  args: { initialPath: `/community/payouts?gardenId=${STORYBOOK_PRIMARY_ADMIN_GARDEN.id}` },
  decorators: communityDecorators(),
};

// Member-directory and member-dialog states live in their focused component
// stories; this route catalog keeps only the payout and inspector journeys.
