import type { Address, Work } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FIXTURE_IMAGE_AGROFORESTRY, daysAgo } from "../../../../../shared/.storybook/fixtures";
import { HubAssessmentQueue } from "./HubAssessmentQueue";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

function work(id: string, title: string, daysAgoCount: number, actionUID: number): Work {
  return {
    id,
    title,
    actionUID,
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [FIXTURE_IMAGE_AGROFORESTRY],
    createdAt: daysAgo(daysAgoCount),
    status: "approved",
  };
}

const APPROVED_WORK: Work[] = [
  work("w1", "Planted 50 native saplings", 2, 1),
  work("w2", "Cleared 40kg of debris", 5, 2),
  work("w3", "Led composting workshop", 9, 3),
];

const ACTIONS_MAP = new Map<number, { title: string }>([
  [1, { title: "Planting event" }],
  [2, { title: "Riverbank cleanup" }],
  [3, { title: "Education workshop" }],
]);

const meta: Meta<typeof HubAssessmentQueue> = {
  title: "Admin/Workflows/Hub/HubAssessmentQueue",
  component: HubAssessmentQueue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hub Assess-stage queue. Shows approved work awaiting bundling into an assessment.",
      },
    },
  },
  args: {
    actionsMap: ACTIONS_MAP,
    selectedGardenName: "Rio Rainforest Lab",
    selectedWorkId: undefined,
    onOpenWorkDetail: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubAssessmentQueue>;

export const WithData: Story = {
  args: {
    items: APPROVED_WORK,
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

export const Empty: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: false,
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
    items: APPROVED_WORK,
    worksLoading: false,
    hasDataError: false,
    selectedWorkId: "w2",
  },
};
