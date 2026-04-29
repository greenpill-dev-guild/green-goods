import type { Meta, StoryObj } from "@storybook/react";
import { DEFAULT_CHAIN_ID, queryKeys, type Action } from "@green-goods/shared";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_ACTIONS,
  STORYBOOK_ADMIN_SHELL_SEEDS,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { adminCanvasRoutes } from "@/routes/views";

interface RouteBackedActionsInspectorStoryProps {
  initialPath?: string;
}

function RouteBackedActionsInspectorStory({
  initialPath = "/actions",
}: RouteBackedActionsInspectorStoryProps) {
  const router = createMemoryRouter(
    [
      {
        element: <CanvasLayout />,
        children: adminCanvasRoutes,
      },
    ],
    { initialEntries: [initialPath] }
  );

  return <RouterProvider router={router} />;
}

const meta: Meta<typeof RouteBackedActionsInspectorStory> = {
  title: "Admin/Workspaces/ActionsSheetDescriptor",
  component: RouteBackedActionsInspectorStory,
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
type Story = StoryObj<typeof RouteBackedActionsInspectorStory>;

const STORYBOOK_DESCRIPTOR_ACTIONS: Action[] = STORYBOOK_ADMIN_ACTIONS.map((action) => ({
  ...action,
  instructions: undefined,
}));

const STORYBOOK_DESCRIPTOR_SEEDS = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [queryKeys.actions.byChain(DEFAULT_CHAIN_ID), STORYBOOK_DESCRIPTOR_ACTIONS],
] as const;

function actionsDescriptorDecorators() {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_DESCRIPTOR_SEEDS),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "actions",
    }),
  ];
}

export const RouteBackedDetail: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/actions/action-canopy-baseline?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(await within(leftSheet).findByText("Canopy baseline")).toBeVisible();
  },
};

export const RouteBackedCreate: Story = {
  args: { initialPath: "/actions/create?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(
      await within(leftSheet).findByRole("heading", { name: "Create action" })
    ).toBeVisible();
  },
};

export const RouteBackedEdit: Story = {
  args: { initialPath: "/actions/action-canopy-baseline/edit?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(await within(leftSheet).findByText("Edit Canopy baseline")).toBeVisible();
  },
};
