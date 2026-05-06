import type { ActivityFilter, GardenActivityEvent, GardenRange } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { OverviewTab } from "./OverviewTab";

const MOCK_ACTIVITY: GardenActivityEvent[] = [
  {
    id: "w-1",
    category: "work",
    title: "Planted 50 native saplings",
    description: "Approved · Rio Rainforest Lab",
    timestamp: hoursAgo(3),
    itemId: "w-1",
  },
  {
    id: "i-1",
    category: "impact",
    title: "Q1 restoration impact certified",
    description: "Assessment bundled and certified on-chain.",
    timestamp: hoursAgo(30),
  },
  {
    id: "c-1",
    category: "community",
    title: "Signal strategy refresh",
    description: "Updated weight scheme to Power.",
    timestamp: hoursAgo(96),
  },
];

const meta: Meta<typeof OverviewTab> = {
  title: "Admin/Workflows/Garden/OverviewTab",
  component: OverviewTab,
  tags: ["autodocs"],
  decorators: [withRouter(["/garden"])],
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
    section: undefined,
    selectedItem: undefined,
    selectedRange: "30d" as GardenRange,
    clearSection: fn(),
    openSection: fn(),
    updateQueryState: fn(),
    setTab: fn(),
    overviewAlerts: [],
    gardenHealthLabel: "Healthy",
    approvedInRangeCount: 14,
    impactVelocityDelta: 12,
    medianReviewAgeHours: 18,
    activityFilter: "all" as ActivityFilter,
    setActivityFilter: fn(),
    filteredActivityEvents: MOCK_ACTIVITY,
    isLoading: false,
    pendingWorkCount: 5,
    assessmentCount30d: 3,
    gardenerCount: 22,
    treasuryBalance: "$12,400",
  },
};

export default meta;
type Story = StoryObj<typeof OverviewTab>;

export const Healthy: Story = {};

export const WithAlerts: Story = {
  args: {
    overviewAlerts: [
      { key: "pending-work", severity: "medium", label: "5 pending work items", onAction: fn() },
      { key: "vault-paused", severity: "high", label: "USDC vault paused", onAction: fn() },
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
