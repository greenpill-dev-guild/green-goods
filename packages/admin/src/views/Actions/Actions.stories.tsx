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
import Actions from "./index";

function ActionsCanvasStory() {
  return (
    <Routes>
      <Route element={<CanvasLayout />}>
        <Route path="/actions" element={<Actions />} />
        <Route path="/actions/create" element={<Actions />} />
        <Route path="/actions/:id" element={<Actions />} />
        <Route path="/actions/:id/edit" element={<Actions />} />
      </Route>
    </Routes>
  );
}

const meta: Meta<typeof ActionsCanvasStory> = {
  title: "Admin/Workspaces/Actions",
  component: ActionsCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seeded Actions workspace coverage through the real CanvasLayout shell, including route-backed create, detail, and edit inspectors.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActionsCanvasStory>;

function actionsDecorators(initialPath: string) {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withRouter([initialPath]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "actions",
    }),
  ];
}

export const Registry: Story = {
  tags: ["visual-harness"],
  render: () => <ActionsCanvasStory />,
  decorators: actionsDecorators("/actions?sort=recent&lifecycle=active"),
};

export const DetailInspector: Story = {
  tags: ["storybook-ci"],
  render: () => <ActionsCanvasStory />,
  decorators: actionsDecorators("/actions/action-canopy-baseline?sort=recent"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Actions" })).toBeVisible();
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(await within(leftSheet).findByText("Canopy baseline")).toBeVisible();
  },
};

export const CreateInspector: Story = {
  tags: ["visual-harness"],
  render: () => <ActionsCanvasStory />,
  decorators: actionsDecorators("/actions/create?sort=recent"),
};

export const EditInspector: Story = {
  tags: ["visual-harness"],
  render: () => <ActionsCanvasStory />,
  decorators: actionsDecorators("/actions/action-canopy-baseline/edit?sort=recent"),
};
