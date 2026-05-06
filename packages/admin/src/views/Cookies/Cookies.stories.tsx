import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
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

function CookiesCanvasStory({ initialPath = "/cookies" }: { initialPath?: string }) {
  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            element: <CanvasLayout />,
            children: adminCanvasRoutes,
          },
        ],
        { initialEntries: [initialPath] }
      ),
    [initialPath]
  );

  return <RouterProvider router={router} />;
}

const meta: Meta<typeof CookiesCanvasStory> = {
  title: "Admin/Workspaces/Cookies",
  component: CookiesCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof CookiesCanvasStory>;

export const TeamCookies: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies" },
};

export const DeployRoute: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies/deploy" },
};
