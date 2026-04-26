import type { Meta, StoryObj } from "@storybook/react";
import { Route, Routes } from "react-router-dom";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { ActionsSheetDescriptor } from "./ActionsSheetDescriptor";
import Actions from "./index";

function RouteBackedActionsInspectorStory() {
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

const meta: Meta<typeof ActionsSheetDescriptor> = {
  title: "Admin/Workspaces/ActionsSheetDescriptor",
  component: ActionsSheetDescriptor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route-backed Actions inspector descriptor exercised through the real CanvasLayout shell.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function actionsDescriptorDecorators(initialPath: string) {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withRouter([initialPath]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "actions",
    }),
  ];
}

export const RouteBackedDetail: Story = {
  tags: ["storybook-ci"],
  render: () => <RouteBackedActionsInspectorStory />,
  decorators: actionsDescriptorDecorators("/actions/action-canopy-baseline?sort=recent"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(await within(leftSheet).findByText("Canopy baseline")).toBeVisible();
  },
};
