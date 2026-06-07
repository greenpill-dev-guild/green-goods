import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import {
  DEFAULT_CHAIN_ID,
  queryKeys,
  type Address,
  type Garden as SharedGarden,
} from "@green-goods/shared";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_GARDENS,
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_OPERATOR_ADDRESS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../storybookCanvasHarness";
import {
  expectAdminShellDarkPalette,
  expectAllVisibleSelectorContrast,
  withTemporaryDocumentTheme,
} from "../storybookPaletteAssertions";

interface GardenCanvasStoryProps {
  initialPath?: string;
}

function GardenCanvasStory({ initialPath = "/garden/overview" }: GardenCanvasStoryProps) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
}

const meta: Meta<typeof GardenCanvasStory> = {
  title: "Admin/Workspaces/Garden",
  component: GardenCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seeded Garden workspace coverage through the real CanvasLayout shell, including overview, impact, create, settings, roles, and hypercert detail entry points.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GardenCanvasStory>;

const STORYBOOK_EMPTY_DOMAIN_GARDEN = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  domainMask: 0,
} satisfies SharedGarden;

const STORYBOOK_EMPTY_DOMAIN_GARDENS = STORYBOOK_ADMIN_GARDENS.map((garden) =>
  garden.id === STORYBOOK_EMPTY_DOMAIN_GARDEN.id ? STORYBOOK_EMPTY_DOMAIN_GARDEN : garden
);
const STORYBOOK_SECONDARY_ADMIN_GARDEN = STORYBOOK_ADMIN_GARDENS[1] as SharedGarden;
const STORYBOOK_SECONDARY_ADMIN_GARDEN_ID =
  STORYBOOK_SECONDARY_ADMIN_GARDEN.id.toLowerCase() as Address;

const STORYBOOK_EMPTY_DOMAIN_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> =
  STORYBOOK_ADMIN_SHELL_SEEDS.map(([key, data]) =>
    data === STORYBOOK_ADMIN_GARDENS ? [key, STORYBOOK_EMPTY_DOMAIN_GARDENS] : [key, data]
  );
const STORYBOOK_SECONDARY_GARDEN_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [queryKeys.assessments.byGardenBase(STORYBOOK_SECONDARY_ADMIN_GARDEN.id, DEFAULT_CHAIN_ID), []],
  [queryKeys.works.merged(STORYBOOK_SECONDARY_ADMIN_GARDEN.id, DEFAULT_CHAIN_ID), []],
  [queryKeys.hypercerts.list(STORYBOOK_SECONDARY_ADMIN_GARDEN.id, DEFAULT_CHAIN_ID, undefined), []],
  [queryKeys.vaults.byGarden(STORYBOOK_SECONDARY_ADMIN_GARDEN_ID, DEFAULT_CHAIN_ID), []],
  [queryKeys.yield.allocations(STORYBOOK_SECONDARY_ADMIN_GARDEN_ID, DEFAULT_CHAIN_ID, 20), []],
  [queryKeys.community.garden(STORYBOOK_SECONDARY_ADMIN_GARDEN_ID, DEFAULT_CHAIN_ID), null],
  [queryKeys.community.pools(STORYBOOK_SECONDARY_ADMIN_GARDEN_ID, DEFAULT_CHAIN_ID), []],
  [queryKeys.conviction.strategies(STORYBOOK_SECONDARY_ADMIN_GARDEN_ID, DEFAULT_CHAIN_ID), []],
];

const STORYBOOK_OPERATOR_ADDRESS_KEY = STORYBOOK_OPERATOR_ADDRESS.toLowerCase() as Address;

const STORYBOOK_DEPLOYER_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [
    queryKeys.role.deploymentPermissions(STORYBOOK_OPERATOR_ADDRESS_KEY, DEFAULT_CHAIN_ID),
    { isOwner: true, isInAllowlist: true, canDeploy: true },
  ],
];

function gardenDecorators({
  garden = STORYBOOK_PRIMARY_ADMIN_GARDEN,
  seeds = STORYBOOK_ADMIN_SHELL_SEEDS,
}: {
  garden?: SharedGarden;
  seeds?: ReadonlyArray<readonly [QueryKey, unknown]>;
} = {}) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    withSelectedAdminGarden(garden),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "garden",
    }),
  ];
}

export const Overview: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/garden/overview" },
  decorators: gardenDecorators(),
  play: async ({ canvasElement }) => {
    await withTemporaryDocumentTheme("dark", async () => {
      const canvas = within(canvasElement);
      await expect(
        await canvas.findByRole("heading", { name: "Garden" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
      ).toBeVisible();
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
          label: "Garden primary action links",
        })
      );
    });
  },
};

export const Activity: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/garden/activity" },
  decorators: gardenDecorators(),
};

export const Members: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/garden/members" },
  decorators: gardenDecorators(),
};

export const Settings: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/garden/settings" },
  decorators: gardenDecorators(),
};

export const GardenSwitchRemainsInteractive: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/garden/overview" },
  decorators: gardenDecorators({ seeds: STORYBOOK_SECONDARY_GARDEN_SEEDS }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);

    await expect(
      await canvas.findByRole(
        "button",
        { name: /Rio Rainforest Lab/ },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();

    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: /Rio Rainforest Lab/ },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    );
    await userEvent.click(
      await page.findByRole("button", { name: "Botanic Commons" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    );
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /Botanic Commons/ })).toBeVisible()
    );
    await expect(
      await canvas.findByRole("heading", { name: "Garden" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();

    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: /Botanic Commons/ },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    );
    await userEvent.click(
      await page.findByRole(
        "button",
        { name: "Rio Rainforest Lab" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    );
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /Rio Rainforest Lab/ })).toBeVisible()
    );
  },
};

export const UrlGardenSync: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: `/garden/settings?gardenAddress=${STORYBOOK_SECONDARY_ADMIN_GARDEN.id}` },
  decorators: gardenDecorators({ seeds: STORYBOOK_SECONDARY_GARDEN_SEEDS }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      await canvas.findByRole("heading", { name: "Garden" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /Botanic Commons/ })).toBeVisible()
    );
    await expect(
      (await canvas.findAllByText("Brazil", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS)).length
    ).toBeGreaterThan(0);
  },
};

export const CreateGardenRoute: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/garden/create" },
  decorators: gardenDecorators({ seeds: STORYBOOK_DEPLOYER_SEEDS }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: "Create Garden" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    await expect(
      await canvas.findByText(/Set the garden profile/i, undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
  },
};

export const CreateGardenRouteUnauthorized: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/garden/create" },
  decorators: gardenDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByTestId("unauthorized", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    await expect(
      await canvas.findByRole("heading", { name: "Unauthorized" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
  },
};

export const EmptyDomains: Story = {
  tags: ["visual-harness", "storybook-ci"],
  args: { initialPath: "/garden/overview" },
  decorators: gardenDecorators({
    garden: STORYBOOK_EMPTY_DOMAIN_GARDEN,
    seeds: STORYBOOK_EMPTY_DOMAIN_SEEDS,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("No domains configured", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    await expect(
      await canvas.findAllByRole(
        "button",
        { name: "Edit domains" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toHaveLength(1);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Edit domains" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    );
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByRole("dialog", { name: "Edit Domains" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
  },
};
