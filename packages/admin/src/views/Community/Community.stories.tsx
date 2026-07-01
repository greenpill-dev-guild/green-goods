import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
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
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../storybookCanvasHarness";
import {
  expectAdminShellDarkPalette,
  expectAllVisibleSelectorContrast,
  withTemporaryDocumentTheme,
} from "../storybookPaletteAssertions";

interface CommunityCanvasStoryProps {
  initialPath?: string;
}

function CommunityCanvasStory({ initialPath = "/community/treasury" }: CommunityCanvasStoryProps) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
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
    await withTemporaryDocumentTheme("dark", async () => {
      const canvas = within(canvasElement);
      await expect(
        await canvas.findByRole("heading", { name: "Community" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
      ).toBeVisible();
      await expect(
        (
          await canvas.findAllByText(
            "Rio Rainforest Lab",
            undefined,
            ADMIN_ROUTE_STORY_QUERY_OPTIONS
          )
        ).length
      ).toBeGreaterThan(0);
      await waitFor(() => expectAdminShellDarkPalette(canvasElement));
      await waitFor(() =>
        expectAllVisibleSelectorContrast(canvasElement, ".text-primary-base", {
          label: "Community primary action links",
        })
      );
      await waitFor(() =>
        expectAllVisibleSelectorContrast(canvasElement, ".bg-success-lighter .text-success-dark", {
          label: "Community success status text",
        })
      );
    });
  },
};

export const VaultInspector: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/community/treasury/vault" },
  decorators: communityDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      await canvas.findByRole(
        "button",
        { name: /Rio Rainforest Lab/ },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    const leftSheet = await canvas.findByTestId(
      "left-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(
      await within(leftSheet).findByText(
        "Total value locked",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    await expect(
      await within(leftSheet).findByText(
        "Net deposited",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    await expect(
      (
        await within(leftSheet).findAllByText(
          "Depositors",
          undefined,
          ADMIN_ROUTE_STORY_QUERY_OPTIONS
        )
      ).length
    ).toBeGreaterThan(0);
  },
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
    const leftSheet = await canvas.findByTestId(
      "left-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(
      await within(leftSheet).findByText(
        "Conviction Voting",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
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

// People tab retired — "Manage members" now opens the roles flow directly
// (views/Garden/ManageMembers.tsx) rather than a browsable Community tab.
// /community/members still resolves (legacy path, see routes/views.tsx) but
// renders that flow, not CommunityView, so it has no story here.
