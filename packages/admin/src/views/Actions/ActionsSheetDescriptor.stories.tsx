import type { Meta, StoryObj } from "@storybook/react";
import { DEFAULT_CHAIN_ID, queryKeys, type Action } from "@green-goods/shared";
import { expect, waitFor, within } from "storybook/test";
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

function expectDesktopSheetClearance({
  appBar,
  canvasElement,
  dialog,
  navigation,
  sheet,
}: {
  appBar: HTMLElement;
  canvasElement: HTMLElement;
  dialog: HTMLElement;
  navigation: HTMLElement;
  sheet: HTMLElement;
}) {
  const appBarRect = appBar.getBoundingClientRect();
  const canvasRect = canvasElement.getBoundingClientRect();
  const dialogRect = dialog.getBoundingClientRect();
  const navigationRect = navigation.getBoundingClientRect();
  const sheetRect = sheet.getBoundingClientRect();

  expect(dialogRect.top).toBeGreaterThanOrEqual(appBarRect.bottom);
  expect(dialogRect.bottom).toBeLessThanOrEqual(navigationRect.top);
  expect(sheetRect.left).toBeGreaterThanOrEqual(canvasRect.left);
  expect(sheetRect.top).toBeGreaterThanOrEqual(appBarRect.bottom);
  expect(sheetRect.bottom).toBeLessThanOrEqual(navigationRect.top);
}

function expectMobileBottomSheetClearance({
  appBar,
  canvasElement,
  dialog,
  navigation,
  sheet,
}: {
  appBar: HTMLElement;
  canvasElement: HTMLElement;
  dialog: HTMLElement;
  navigation: HTMLElement;
  sheet: HTMLElement;
}) {
  const appBarRect = appBar.getBoundingClientRect();
  const canvasRect = canvasElement.getBoundingClientRect();
  const dialogRect = dialog.getBoundingClientRect();
  const navigationRect = navigation.getBoundingClientRect();
  const sheetRect = sheet.getBoundingClientRect();

  expect(Math.round(window.innerWidth)).toBe(390);
  expect(Math.round(window.innerHeight)).toBe(844);
  expect(dialogRect.top).toBeGreaterThanOrEqual(appBarRect.bottom);
  expect(dialogRect.bottom).toBeLessThanOrEqual(navigationRect.top);
  expect(sheetRect.left).toBeGreaterThanOrEqual(canvasRect.left);
  expect(sheetRect.right).toBeLessThanOrEqual(canvasRect.right);
  expect(sheetRect.top).toBeGreaterThanOrEqual(appBarRect.bottom);
  expect(sheetRect.bottom).toBeLessThanOrEqual(navigationRect.top);
}

function getAppBarRoot(canvasElement: HTMLElement): HTMLElement {
  const appBar = canvasElement.querySelector<HTMLElement>(
    '[data-component="AppBar"][data-slot="root"]'
  );
  expect(appBar).not.toBeNull();
  return appBar as HTMLElement;
}

export const RouteBackedDetail: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/actions/action-canopy-baseline?sort=recent" },
  decorators: actionsDescriptorDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId(
      "left-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(leftSheet).toHaveAttribute("data-width", "default");
    await expect(
      await within(leftSheet).findByText(
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId(
      "left-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(leftSheet).toHaveAttribute("data-width", "wide");
    await waitFor(
      () =>
        expectDesktopSheetClearance({
          appBar: getAppBarRoot(canvasElement),
          canvasElement,
          dialog: canvas.getByTestId("left-sheet-dialog"),
          navigation: canvas.getByRole("navigation"),
          sheet: leftSheet,
        }),
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(
      await within(leftSheet).findByRole(
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bottomSheet = await canvas.findByTestId(
      "bottom-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(bottomSheet).toHaveAttribute("data-component", "BottomSheet");
    await waitFor(
      () =>
        expectMobileBottomSheetClearance({
          appBar: getAppBarRoot(canvasElement),
          canvasElement,
          dialog: canvas.getByTestId("bottom-sheet-dialog"),
          navigation: canvas.getByRole("navigation"),
          sheet: bottomSheet,
        }),
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(
      await within(bottomSheet).findByRole(
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId(
      "left-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(leftSheet).toHaveAttribute("data-width", "wide");
    await expect(
      await within(leftSheet).findByText(
        "Edit Canopy baseline",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};
