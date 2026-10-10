import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  STORYBOOK_ADMIN_VAULTS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withSeededQueryClient,
  withRouter,
} from "../../../../../shared/.storybook/decorators";
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../../storybookCanvasHarness";

import { VaultActionRouteDialog } from "./VaultActionRouteDialog";

interface RouteBackedVaultActionStoryProps {
  action: "deposit" | "withdraw";
}

const primaryVault = STORYBOOK_ADMIN_VAULTS[0]!;
const routeContext = `gardenId=${STORYBOOK_PRIMARY_ADMIN_GARDEN.id}&item=${primaryVault.asset}`;

function RouteBackedVaultActionStory({ action }: RouteBackedVaultActionStoryProps) {
  return (
    <StorybookAdminCanvasRoute
      initialPath={`/community/endowment/vault/${action}?${routeContext}`}
    />
  );
}

const meta: Meta<typeof RouteBackedVaultActionStory> = {
  title: "Admin/Workspaces/VaultActionRouteDialog",
  component: RouteBackedVaultActionStory,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentityRole("deployer"),
    withSeededQueryClient(STORYBOOK_ADMIN_DEPLOYER_SEEDS),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[calc(100vh-2rem)] min-h-[640px]",
      workspace: "community",
    }),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route-backed Community endowment deposit and withdraw dialog wrapper, exercised through the real CanvasLayout shell with seeded garden and vault query data.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RouteBackedVaultActionStory>;

export const RouteBackedDeposit: Story = {
  args: { action: "deposit" },
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(dialog).toHaveAttribute("data-component", "AdminDialog");
    await expect(
      await within(dialog).findByRole(
        "heading",
        { name: "Deposit" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

export const RouteBackedWithdraw: Story = {
  args: { action: "withdraw" },
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(dialog).toHaveAttribute("data-component", "AdminDialog");
    await expect(
      await within(dialog).findByRole(
        "heading",
        { name: "Withdraw" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

export const RejectedGardenAddress: Story = {
  args: { action: "deposit" },
  tags: ["storybook-ci"],
  decorators: [withRouter(["/community/endowment/vault/deposit?gardenId=community-garden"])],
  render: () => <VaultActionRouteDialog action="deposit" gardenAddress="community-garden" />,
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(within(dialog).getByRole("alert")).toHaveTextContent("Garden not found");
    await expect(within(dialog).queryByText("Loading vault data...")).not.toBeInTheDocument();
    await expect(
      within(dialog).queryByRole("button", { name: "Try Again" })
    ).not.toBeInTheDocument();
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
  },
};
