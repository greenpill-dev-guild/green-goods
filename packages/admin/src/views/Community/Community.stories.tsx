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
import Community from "./index";

function CommunityCanvasStory() {
  return (
    <Routes>
      <Route element={<CanvasLayout />}>
        <Route path="/community/treasury" element={<Community />} />
        <Route path="/community/treasury/vault" element={<Community />} />
        <Route path="/community/governance" element={<Community />} />
        <Route path="/community/governance/strategies" element={<Community />} />
        <Route path="/community/governance/signal-pool/:poolType" element={<Community />} />
        <Route path="/community/payouts" element={<Community />} />
        <Route path="/community/members" element={<Community />} />
      </Route>
    </Routes>
  );
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

function communityDecorators(initialPath: string) {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withRouter([initialPath]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "community",
    }),
  ];
}

export const Treasury: Story = {
  tags: ["storybook-ci"],
  render: () => <CommunityCanvasStory />,
  decorators: communityDecorators("/community/treasury"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Community" })).toBeVisible();
    await expect((await canvas.findAllByText("Rio Rainforest Lab")).length).toBeGreaterThan(0);
  },
};

export const VaultInspector: Story = {
  tags: ["visual-harness"],
  render: () => <CommunityCanvasStory />,
  decorators: communityDecorators("/community/treasury/vault"),
};

export const GovernancePools: Story = {
  tags: ["visual-harness"],
  render: () => <CommunityCanvasStory />,
  decorators: communityDecorators("/community/governance"),
};

export const GovernanceStrategiesInspector: Story = {
  render: () => <CommunityCanvasStory />,
  decorators: communityDecorators("/community/governance/strategies"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(await within(leftSheet).findByText("Conviction Voting")).toBeVisible();
  },
};

export const SignalPoolInspector: Story = {
  tags: ["visual-harness"],
  render: () => <CommunityCanvasStory />,
  decorators: communityDecorators("/community/governance/signal-pool/action"),
};

export const YieldPayouts: Story = {
  tags: ["visual-harness"],
  render: () => <CommunityCanvasStory />,
  decorators: communityDecorators("/community/payouts"),
};

export const Members: Story = {
  tags: ["visual-harness"],
  render: () => <CommunityCanvasStory />,
  decorators: communityDecorators("/community/members"),
};
