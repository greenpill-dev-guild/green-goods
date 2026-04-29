import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import type { Garden as SharedGarden } from "@green-goods/shared";
import { Route, Routes } from "react-router-dom";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_GARDENS,
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import CreateGarden from "./CreateGarden";
import Garden from "./index";

function GardenCanvasStory() {
  return (
    <Routes>
      <Route element={<CanvasLayout />}>
        <Route path="/garden/overview" element={<Garden />} />
        <Route path="/garden/impact" element={<Garden />} />
        <Route path="/garden/impact/hypercerts/:hypercertId" element={<Garden />} />
        <Route path="/garden/settings" element={<Garden />} />
        <Route path="/garden/create" element={<CreateGarden />} />
      </Route>
    </Routes>
  );
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

function gardenDecorators(
  initialPath: string,
  {
    garden = STORYBOOK_PRIMARY_ADMIN_GARDEN,
    seeds = STORYBOOK_ADMIN_SHELL_SEEDS,
  }: {
    garden?: SharedGarden;
    seeds?: ReadonlyArray<readonly [QueryKey, unknown]>;
  } = {}
) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    withSelectedAdminGarden(garden),
    withRouter([initialPath]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "garden",
    }),
  ];
}

export const Overview: Story = {
  tags: ["storybook-ci"],
  render: () => <GardenCanvasStory />,
  decorators: gardenDecorators("/garden/overview"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Garden" })).toBeVisible();
    await expect((await canvas.findAllByText("Rio Rainforest Lab")).length).toBeGreaterThan(0);
  },
};

export const Impact: Story = {
  tags: ["visual-harness"],
  render: () => <GardenCanvasStory />,
  decorators: gardenDecorators("/garden/impact"),
};

export const HypercertInspector: Story = {
  tags: ["visual-harness"],
  render: () => <GardenCanvasStory />,
  decorators: gardenDecorators("/garden/impact/hypercerts/hypercert-rio-baseline"),
};

export const Settings: Story = {
  tags: ["visual-harness"],
  render: () => <GardenCanvasStory />,
  decorators: gardenDecorators("/garden/settings"),
};

export const CreateGardenRoute: Story = {
  render: () => <GardenCanvasStory />,
  decorators: gardenDecorators("/garden/create"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Create Garden" })).toBeVisible();
    await expect(await canvas.findByText(/Set the garden profile/i)).toBeVisible();
  },
};

export const EmptyDomains: Story = {
  tags: ["visual-harness", "storybook-ci"],
  render: () => <GardenCanvasStory />,
  decorators: gardenDecorators("/garden/overview", {
    garden: STORYBOOK_EMPTY_DOMAIN_GARDEN,
    seeds: STORYBOOK_EMPTY_DOMAIN_SEEDS,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("No domains configured")).toBeVisible();
    await expect(await canvas.findAllByRole("button", { name: "Edit domains" })).toHaveLength(1);
  },
};
