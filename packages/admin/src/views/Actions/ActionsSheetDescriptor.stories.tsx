import type { Meta, StoryObj } from "@storybook/react";
import { DEFAULT_CHAIN_ID, queryKeys, type Action } from "@green-goods/shared";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_ACTIONS,
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../storybookCanvasHarness";

interface RouteBackedActionsInspectorStoryProps {
  initialPath?: string;
}

function RouteBackedActionsInspectorStory({
  initialPath = "/actions",
}: RouteBackedActionsInspectorStoryProps) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
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
  ...STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  [queryKeys.actions.byChain(DEFAULT_CHAIN_ID), STORYBOOK_DESCRIPTOR_ACTIONS],
] as const;

const ADMIN_MOBILE_390_VIEWPORT = {
  adminMobile390x844: {
    name: "Admin mobile 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

function actionsDescriptorDecorators() {
  return [
    withAdminIdentityRole("deployer"),
    withSeededQueryClient(STORYBOOK_DESCRIPTOR_SEEDS),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[calc(100vh-2rem)] min-h-[640px]",
      workspace: "actions",
    }),
  ];
}

export const RouteBackedDetail: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/actions/action-canopy-baseline?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  play: async ({ canvasElement: _canvasElement }) => {
    // Left/bottom canvas sheets are retired — the inspector now renders as an
    // AdminDialog that portals to document.body (role="dialog").
    const body = within(document.body);
    const inspector = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(inspector).toHaveAttribute("data-component", "AdminDialog");
    await expect(
      await within(inspector).findByText(
        "Canopy baseline",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

export const RouteBackedCreate: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/actions/create?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    const inspector = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(inspector).toHaveAttribute("data-component", "AdminDialog");
    await expect(
      await within(inspector).findByRole(
        "heading",
        { name: "Create action" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

export const RouteBackedCreateMobile: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/actions/create?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  parameters: {
    viewport: {
      defaultViewport: "adminMobile390x844",
      viewports: ADMIN_MOBILE_390_VIEWPORT,
    },
  },
  play: async ({ canvasElement: _canvasElement }) => {
    // On mobile the AdminDialog presents as a bottom sheet (built into the
    // dialog), still portaled to document.body with role="dialog".
    const body = within(document.body);
    const inspector = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(inspector).toHaveAttribute("data-component", "AdminDialog");
    await expect(inspector).toHaveAttribute("data-mobile", "sheet");
    await expect(
      await within(inspector).findByRole(
        "heading",
        { name: "Create action" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

export const RouteBackedEdit: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/actions/action-canopy-baseline/edit?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    const inspector = await body.findByRole("dialog", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS);
    await expect(inspector).toHaveAttribute("data-component", "AdminDialog");
    await expect(
      await within(inspector).findByText(
        "Edit Canopy baseline",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};
