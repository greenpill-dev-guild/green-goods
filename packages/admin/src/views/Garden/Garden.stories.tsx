import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import {
  DEFAULT_CHAIN_ID,
  queryKeys,
  type Address,
  type Garden as SharedGarden,
} from "@green-goods/shared";
import { useMemo } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, within } from "storybook/test";
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
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { adminCanvasRoutes } from "@/routes/views";

interface GardenCanvasStoryProps {
  initialPath?: string;
}

function GardenCanvasStory({ initialPath = "/garden/overview" }: GardenCanvasStoryProps) {
  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            element: <CanvasLayout />,
            children: adminCanvasRoutes,
          },
        ],
        {
          initialEntries: [initialPath],
        }
      ),
    [initialPath]
  );

  return <RouterProvider router={router} />;
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

const STORYBOOK_EMPTY_DOMAIN_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> =
  STORYBOOK_ADMIN_SHELL_SEEDS.map(([key, data]) =>
    data === STORYBOOK_ADMIN_GARDENS ? [key, STORYBOOK_EMPTY_DOMAIN_GARDENS] : [key, data]
  );

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
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Garden" })).toBeVisible();
    await expect((await canvas.findAllByText("Rio Rainforest Lab")).length).toBeGreaterThan(0);
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

export const CreateGardenRoute: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/garden/create" },
  decorators: gardenDecorators({ seeds: STORYBOOK_DEPLOYER_SEEDS }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Create Garden" })).toBeVisible();
    await expect(await canvas.findByText(/Set the garden profile/i)).toBeVisible();
  },
};

export const CreateGardenRouteUnauthorized: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/garden/create" },
  decorators: gardenDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId("unauthorized")).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Unauthorized" })).toBeVisible();
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
    await expect(await canvas.findByText("No domains configured")).toBeVisible();
    await expect(await canvas.findAllByRole("button", { name: "Edit domains" })).toHaveLength(1);
  },
};
