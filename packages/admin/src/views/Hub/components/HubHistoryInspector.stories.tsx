import type { Meta, StoryObj } from "@storybook/react";
import { hoursAgo as hoursAgoTs } from "../../../../../shared/.storybook/fixtures";
import { HubHistoryInspector } from "./HubHistoryInspector";
import type { ActivityEvent } from "../hub.utils";

function event(
  id: string,
  category: ActivityEvent["category"],
  title: string,
  description: string,
  hoursAgoCount: number,
  href?: string,
  itemId?: string
): ActivityEvent {
  return {
    id,
    category,
    title,
    description,
    timestamp: hoursAgoTs(hoursAgoCount),
    href,
    itemId,
  };
}

const meta: Meta<typeof HubHistoryInspector> = {
  title: "Admin/Workflows/Hub/HubHistoryInspector",
  component: HubHistoryInspector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Right-sheet inspector for a selected history event. Shows category pill, title, description, and — when present — an Open-linked-view CTA.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HubHistoryInspector>;

export const WorkEventWithLink: Story = {
  args: {
    event: event(
      "w-1",
      "work",
      "Planted 50 saplings",
      "Approved · Rio Rainforest Lab",
      3,
      "/hub/work/work-1",
      "work-1"
    ),
  },
};

export const ImpactEventNoLink: Story = {
  args: {
    event: event(
      "i-1",
      "impact",
      "Q1 restoration impact certified",
      "Assessment bundled and certified on-chain.",
      30
    ),
  },
};

export const CommunityEvent: Story = {
  args: {
    event: event(
      "c-1",
      "community",
      "Signal strategy refresh",
      "Updated weight scheme to Power.",
      96,
      "/community/strategies"
    ),
  },
};
