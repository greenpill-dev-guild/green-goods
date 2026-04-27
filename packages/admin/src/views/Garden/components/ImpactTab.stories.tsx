import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { daysAgo, hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { ImpactTab } from "./ImpactTab";

const GARDEN_ID = "0x1234567890123456789012345678901234567890";

const ASSESSMENTS = [
  {
    id: "0xabc0000000000000000000000000000000000000000000000000000000000001",
    title: "Q1 restoration survey",
    assessmentType: "impact",
    createdAt: daysAgo(4),
  },
  {
    id: "0xabc0000000000000000000000000000000000000000000000000000000000002",
    title: "Workshop cohort check-in",
    assessmentType: "education",
    createdAt: daysAgo(10),
  },
];

const HYPERCERTS = [
  { id: "hc-1", title: "Atlantic Forest planting — Q1", mintedAt: hoursAgo(72) },
  { id: "hc-2", title: "Community workshop cohort", mintedAt: daysAgo(12) },
  { id: "hc-3", title: undefined, mintedAt: daysAgo(21) },
];

const meta: Meta<typeof ImpactTab> = {
  title: "Admin/Workflows/Garden/ImpactTab",
  component: ImpactTab,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/garden/impact"])],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Impact tab of the garden detail route. Recent hypercerts + assessments. Section argument drills into `assessments` or `hypercerts` panels.",
      },
    },
  },
  args: {
    garden: { id: GARDEN_ID, chainId: 42161 },
    gardenId: GARDEN_ID,
    canManage: true,
    canReview: true,
    section: undefined,
    selectedItem: undefined,
    clearSection: fn(),
    openSection: fn(),
    assessments: ASSESSMENTS,
    fetchingAssessments: false,
    assessmentsError: null,
    hypercerts: HYPERCERTS,
    hypercertsLoading: false,
    domainLabels: ["Agroforestry", "Education"],
    approvedInLastThirtyDays: 18,
  },
};

export default meta;
type Story = StoryObj<typeof ImpactTab>;

export const WithData: Story = {};

export const Loading: Story = {
  args: {
    fetchingAssessments: true,
    hypercertsLoading: true,
  },
};

export const Empty: Story = {
  args: {
    assessments: [],
    hypercerts: [],
  },
};

export const AssessmentsSection: Story = {
  args: {
    section: "assessments",
  },
};

export const HypercertsSection: Story = {
  args: {
    section: "hypercerts",
  },
};
