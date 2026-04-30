import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, within } from "storybook/test";
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

interface CommunityCanvasStoryProps {
  initialPath?: string;
}

function CommunityCanvasStory({ initialPath = "/community/treasury" }: CommunityCanvasStoryProps) {
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

const meta: Meta<typeof CommunityCanvasStory> = {
  title: "Admin/Workspaces/Community",
  component: CommunityCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seeded Community workspace coverage through the real CanvasLayout shell, including treasury, governance pools, payouts, members, and route-backed detail entry points.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommunityCanvasStory>;

function communityDecorators() {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "community",
    }),
  ];
}

export const Treasury: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/community/treasury" },
  decorators: communityDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Community" })).toBeVisible();
    await expect((await canvas.findAllByText("Rio Rainforest Lab")).length).toBeGreaterThan(0);
  },
};

export const VaultInspector: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/treasury/vault" },
  decorators: communityDecorators(),
};

export const GovernancePools: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/governance" },
  decorators: communityDecorators(),
};

export const GovernanceStrategiesInspector: Story = {
  args: { initialPath: "/community/governance/strategies" },
  decorators: communityDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(await within(leftSheet).findByText("Conviction Voting")).toBeVisible();
  },
};

export const SignalPoolInspector: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/governance/signal-pool/action" },
  decorators: communityDecorators(),
};

export const YieldPayouts: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/payouts" },
  decorators: communityDecorators(),
};

export const Members: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/members" },
  decorators: communityDecorators(),
};

export const CampaignCookies: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/community/cookies" },
  decorators: communityDecorators(),
};
