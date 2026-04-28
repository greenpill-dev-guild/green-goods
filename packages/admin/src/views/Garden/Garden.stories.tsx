import type { Meta, StoryObj } from "@storybook/react";
import { Route, Routes } from "react-router-dom";
import { expect, within } from "storybook/test";
import {
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
import Garden from "./index";

function GardenCanvasStory() {
  return (
    <Routes>
      <Route element={<CanvasLayout />}>
        <Route path="/garden/overview" element={<Garden />} />
        <Route path="/garden/impact" element={<Garden />} />
        <Route path="/garden/impact/hypercerts/:hypercertId" element={<Garden />} />
        <Route path="/garden/settings" element={<Garden />} />
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
          "Seeded Garden workspace coverage through the real CanvasLayout shell, including overview, impact, settings, roles, and hypercert detail entry points.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GardenCanvasStory>;

function gardenDecorators(initialPath: string) {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
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
