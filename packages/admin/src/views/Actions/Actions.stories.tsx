import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../storybookCanvasHarness";

interface ActionsCanvasStoryProps {
  initialPath?: string;
}

function ActionsCanvasStory({ initialPath = "/actions" }: ActionsCanvasStoryProps) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
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

function actionsDecorators() {
  return [
    withAdminIdentityRole("deployer"),
    withSeededQueryClient(STORYBOOK_ADMIN_DEPLOYER_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "actions",
    }),
  ];
}

export const Registry: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/actions?sort=recent&lifecycle=active" },
  decorators: actionsDecorators(),
};

export const DetailInspector: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/actions/action-canopy-baseline?sort=recent" },
  decorators: actionsDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: "Actions" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    const leftSheet = await canvas.findByTestId(
      "left-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(
      await within(leftSheet).findByText(
        "Canopy baseline",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

export const CreateInspector: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/actions/create?sort=recent" },
  decorators: actionsDecorators(),
};

export const EditInspector: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/actions/action-canopy-baseline/edit?sort=recent" },
  decorators: actionsDecorators(),
};
