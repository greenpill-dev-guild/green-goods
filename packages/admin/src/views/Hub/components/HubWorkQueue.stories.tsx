import type { Address, Work } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FIXTURE_WORK_MEDIA, daysAgo } from "../../../../../shared/.storybook/fixtures";
import { HubWorkQueue } from "./HubWorkQueue";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

function work(
  id: string,
  title: string,
  daysAgoCount: number,
  actionUID: number,
  mediaCount = 2
): Work {
  return {
    id,
    title,
    actionUID,
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: FIXTURE_WORK_MEDIA.slice(0, mediaCount),
    createdAt: daysAgo(daysAgoCount),
    status: "pending",
  };
}

const PENDING_WORK: Work[] = [
  work("w1", "Planted 50 native saplings", 1, 1, 3),
  work("w2", "Cleared 40kg of debris", 2, 2, 1),
  work("w3", "Led composting workshop", 3, 3, 0),
  work("w4", "Solar panel maintenance", 4, 4, 2),
];

const ACTIONS_MAP = new Map<number, { title: string }>([
  [1, { title: "Planting event" }],
  [2, { title: "Riverbank cleanup" }],
  [3, { title: "Education workshop" }],
  [4, { title: "Solar service session" }],
]);

const meta: Meta<typeof HubWorkQueue> = {
  title: "Admin/Workflows/Hub/HubWorkQueue",
  component: HubWorkQueue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hub Work-stage queue. Pending work across all gardens in scope. Search clears via `onClearSearch`.",
      },
    },
  },
  args: {
    actionsMap: ACTIONS_MAP,
    selectedGardenName: "Rio Rainforest Lab",
    selectedWorkId: undefined,
    normalizedSearch: "",
    debouncedSearch: "",
    onOpenWorkDetail: fn(),
    onClearSearch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubWorkQueue>;

export const WithData: Story = {
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: false,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    worksLoading: true,
    hasDataError: false,
  },
};

export const AllCaughtUp: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: false,
  },
};

export const NoSearchResults: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: false,
    normalizedSearch: "foobar",
    debouncedSearch: "foobar",
  },
};

export const DataError: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: true,
  },
};

export const WithSelection: Story = {
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: false,
    selectedWorkId: "w2",
  },
};
