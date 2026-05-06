import type { Meta, StoryObj } from "@storybook/react";
import type { ActivityEvent } from "@green-goods/shared";
import { fn } from "storybook/test";
import { hoursAgo as hoursAgoTs } from "../../../../../shared/.storybook/fixtures";
import { HubHistoryQueue } from "./HubHistoryQueue";

function event(
  id: string,
  category: "work" | "impact" | "community",
  title: string,
  description: string,
  hoursAgoCount: number,
  itemId?: string
): ActivityEvent {
  return {
    id,
    category,
    title,
    description,
    timestamp: hoursAgoTs(hoursAgoCount),
    itemId,
  };
}

const HISTORY: ActivityEvent[] = [
  event("w-1", "work", "Planted 50 saplings", "Approved • Rio Rainforest Lab", 3, "work-1"),
  event(
    "i-1",
    "impact",
    "Q1 restoration impact certified",
    "Assessment bundled and certified on-chain.",
    30
  ),
  event("c-1", "community", "Signal strategy refresh", "Updated weight scheme to Power.", 96),
];

const meta: Meta<typeof HubHistoryQueue> = {
  title: "Admin/Workflows/Hub/HubHistoryQueue",
  component: HubHistoryQueue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hub History-stage queue. Cross-category feed (work + impact + community) of recent events in the selected garden.",
      },
    },
  },
  args: {
    selectedHistoryEventId: undefined,
    selectedWorkId: undefined,
    onOpenHistoryEvent: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubHistoryQueue>;

export const WithData: Story = {
  args: {
    items: HISTORY,
    worksLoading: false,
    fetchingAssessments: false,
    hypercertsLoading: false,
    allocationsLoading: false,
    hasDataError: false,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    worksLoading: true,
    fetchingAssessments: false,
    hypercertsLoading: false,
    allocationsLoading: false,
    hasDataError: false,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    worksLoading: false,
    fetchingAssessments: false,
    hypercertsLoading: false,
    allocationsLoading: false,
    hasDataError: false,
  },
};

export const DataError: Story = {
  args: {
    items: [],
    worksLoading: false,
    fetchingAssessments: false,
    hypercertsLoading: false,
    allocationsLoading: false,
    hasDataError: true,
  },
};
