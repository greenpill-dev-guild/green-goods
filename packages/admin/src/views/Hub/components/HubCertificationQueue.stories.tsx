import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { HubCertificationQueue } from "./HubCertificationQueue";

const ITEMS = [
  {
    id: "0xabc1",
    title: "Q1 restoration impact",
    description: "Bundling March planting cohort and aggregated survival checks.",
    assessmentType: "impact",
    createdAt: daysAgo(2),
  },
  {
    id: "0xabc2",
    title: "Workshop cohort results",
    description: null,
    assessmentType: "education",
    createdAt: daysAgo(6),
  },
];

const meta: Meta<typeof HubCertificationQueue> = {
  title: "Admin/Workflows/Hub/HubCertificationQueue",
  component: HubCertificationQueue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hub Certify-stage queue. Assessments ready to mint as hypercerts. When `canManage` is false, rows display the read-only handoff status.",
      },
    },
  },
  args: {
    selectedCertificationId: undefined,
    onOpenCertification: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubCertificationQueue>;

export const WithItemsManage: Story = {
  args: {
    items: ITEMS,
    fetchingAssessments: false,
    hypercertsLoading: false,
    hasDataError: false,
    canManage: true,
  },
};

export const ReadOnlyHandoff: Story = {
  args: {
    items: ITEMS,
    fetchingAssessments: false,
    hypercertsLoading: false,
    hasDataError: false,
    canManage: false,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    fetchingAssessments: true,
    hypercertsLoading: false,
    hasDataError: false,
    canManage: true,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    fetchingAssessments: false,
    hypercertsLoading: false,
    hasDataError: false,
    canManage: true,
  },
};

export const DataError: Story = {
  args: {
    items: [],
    fetchingAssessments: false,
    hypercertsLoading: false,
    hasDataError: true,
    canManage: true,
  },
};
