import type {
  ActivityFilter,
  GardenActivityEvent,
  GardenRange,
} from "@green-goods/shared/types/garden-detail";
import type { KarmaIntegrationController } from "@green-goods/shared/hooks/garden/useKarmaIntegration";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { FIXTURE_IMAGE_AGROFORESTRY, hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "../../../../../shared/.storybook/adminFixtures";
import { OverviewTab } from "./OverviewTab";

const MOCK_ACTIVITY: GardenActivityEvent[] = [
  {
    id: "w-1",
    category: "work",
    title: "Planted 50 native saplings",
    description: "Submitted work",
    actorAddress: STORYBOOK_PRIMARY_ADMIN_GARDEN.owners[0],
    photo: FIXTURE_IMAGE_AGROFORESTRY,
    statusLabel: "Approved",
    statusTone: "success",
    href: "/hub/work/w-1",
    timestamp: hoursAgo(3) * 1000,
    itemId: "w-1",
  },
  {
    id: "i-1",
    category: "impact",
    title: "Q1 restoration impact certified",
    description: "Assessment bundled and certified on-chain.",
    timestamp: hoursAgo(30) * 1000,
  },
  {
    id: "c-1",
    category: "community",
    title: "Signal strategy refresh",
    description: "Updated weight scheme to Power.",
    timestamp: hoursAgo(96) * 1000,
  },
];

const KARMA_INTEGRATION = {
  status: {
    status: "synced",
    chainId: 42161,
    gardenAddress: "0x0000000000000000000000000000000000000001",
    projectUID: null,
    profileUrl: "https://www.karmahq.org/project/rio-rainforest-lab",
    syncVersion: 1,
    requiredSyncVersion: 1,
    reason: null,
  },
  profileUrl: "https://www.karmahq.org/project/rio-rainforest-lab",
  canReconcile: true,
  isLoading: false,
  isFetching: false,
  isReconciling: false,
  isPending: false,
  error: null,
  reconcile: async () => undefined,
  signatures: 1,
  progress: null,
  hold: null,
  isSettlingHold: false,
  checkHoldAgain: async () => undefined,
  moveOnFromHold: async () => undefined,
} satisfies KarmaIntegrationController;

const meta: Meta<typeof OverviewTab> = {
  title: "Admin/Workflows/Garden/OverviewTab",
  component: OverviewTab,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/garden"])],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Overview tab for the garden detail route. Aggregates alerts, health, activity feed, and sticky rail stats. All inputs are plain props so the tab renders as a pure state catalog.",
      },
    },
  },
  args: {
    gardenId: STORYBOOK_PRIMARY_ADMIN_GARDEN.id,
    canManage: true,
    mode: "health",
    section: undefined,
    selectedItem: undefined,
    selectedRange: "30d" as GardenRange,
    clearSection: fn(),
    openSection: fn(),
    updateQueryState: fn(),
    overviewAlerts: [],
    gardenHealthLabel: "Healthy",
    approvedInRangeCount: 14,
    impactVelocityDelta: 12,
    medianReviewLatencyMs: 2.4 * 24 * 60 * 60 * 1000,
    activityFilter: "all" as ActivityFilter,
    setActivityFilter: fn(),
    filteredActivityEvents: MOCK_ACTIVITY,
    isLoading: false,
    pendingWorkCount: 5,
    assessmentCount30d: 3,
    gardenerCount: 22,
    treasuryBalance: "$12,400",
    karmaIntegration: KARMA_INTEGRATION,
  },
};

export default meta;
type Story = StoryObj<typeof OverviewTab>;

export const Healthy: Story = {};

export const WithAlerts: Story = {
  args: {
    overviewAlerts: [
      {
        key: "work-warning",
        severity: "warn",
        label: "2 works have waited over a week.",
        onAction: fn(),
      },
      { key: "vault-paused", severity: "critical", label: "USDC vault paused", onAction: fn() },
    ],
  },
};

/** Critical only when review has stalled: work waited a week and no review landed in the last one. */
export const StalledQueue: Story = {
  args: {
    gardenHealthLabel: "Critical",
    medianReviewLatencyMs: 23 * 24 * 60 * 60 * 1000,
    overviewAlerts: [
      {
        key: "work-critical",
        severity: "critical",
        label: "No reviews in 7 days, and 5 works are waiting.",
        onAction: fn(),
      },
    ],
  },
};

/** Work waiting over a week while reviews still land reads Needs attention, not Critical. */
export const WorkWaitingOverAWeek: Story = {
  args: {
    gardenHealthLabel: "Needs attention",
    medianReviewLatencyMs: 3 * 24 * 60 * 60 * 1000,
    overviewAlerts: [
      {
        key: "work-warning",
        severity: "warn",
        label: "1 work has waited over a week.",
        onAction: fn(),
      },
    ],
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    filteredActivityEvents: [],
  },
};

export const EmptyActivity: Story = {
  args: {
    filteredActivityEvents: [],
    approvedInRangeCount: 0,
    pendingWorkCount: 0,
  },
};

export const EvaluatorActivity: Story = {
  tags: ["storybook-ci"],
  args: {
    mode: "activity",
    filteredActivityEvents: [
      { ...MOCK_ACTIVITY[0], href: "/hub/work/w-1" },
      { ...MOCK_ACTIVITY[2], href: undefined },
    ],
  },
  play: async ({ args, canvasElement }) => {
    if (args.activityFilter !== "all") return;
    const canvas = within(canvasElement);
    const title = await canvas.findByText("Signal strategy refresh", { exact: true });
    const row = title.closest(".gg-item-row")!;
    const badge = row.querySelector(".gg-item-row-mark")!;
    const body = row.querySelector(".gg-item-row-body")!;
    await document.fonts.ready;
    await expect(badge).toBeVisible();
    const bounds = badge.getBoundingClientRect();
    await expect(bounds.left).toBeGreaterThanOrEqual(row.getBoundingClientRect().left);
    await expect(bounds.right).toBeLessThanOrEqual(body.getBoundingClientRect().left);
    const center = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + 4);
    await expect(badge.contains(center)).toBe(true);
  },
};

export const ActivityPagination: Story = {
  tags: ["storybook-ci"],
  args: {
    mode: "activity",
    filteredActivityEvents: Array.from({ length: 23 }, (_, index) => ({
      ...MOCK_ACTIVITY[0],
      id: `work-${index}`,
      title: `Planted native saplings ${index + 1}`,
      description: "Submitted work",
      statusLabel: "Pending",
      statusTone: "neutral",
      href: `/hub/work/work-${index}`,
      timestamp: hoursAgo(index * 24) * 1000,
    })),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".gg-item-row")).toHaveLength(20);
    await expect(
      within(canvasElement).getByRole("heading", {
        name: new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(hoursAgo(24) * 1000),
      })
    ).toBeVisible();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Show More" }));
    await expect(canvasElement.querySelectorAll(".gg-item-row")).toHaveLength(23);
  },
};
