import type { Meta, StoryObj } from "@storybook/react";
import { withRouter } from "../../../../shared/.storybook/decorators";
import { GardenAssessmentsPanel } from "./GardenAssessmentsPanel";

const MOCK_ASSESSMENTS = [
  {
    id: "0xabc0000000000000000000000000000000000000000000000000000000000001",
    title: "Q1 restoration survey",
    assessmentType: "impact",
    domain: 1,
    createdAt: 1712534400,
  },
  {
    id: "0xabc0000000000000000000000000000000000000000000000000000000000002",
    title: "Workshop cohort check-in",
    assessmentType: "education",
    domain: 2,
    createdAt: 1711929600,
  },
];

const GARDEN_ID = "0x1234567890123456789012345678901234567890";

const meta: Meta<typeof GardenAssessmentsPanel> = {
  title: "Admin/Workflows/Garden/GardenAssessmentsPanel",
  component: GardenAssessmentsPanel,
  tags: ["autodocs"],
  decorators: [withRouter(["/garden"])],
  parameters: {
    docs: {
      description: {
        component:
          "Compact card listing recent assessments for a garden with links to EAS Explorer and the impact route.",
      },
    },
  },
  args: {
    gardenId: GARDEN_ID,
    chainId: 42161,
  },
};

export default meta;
type Story = StoryObj<typeof GardenAssessmentsPanel>;

export const WithAssessments: Story = {
  args: {
    assessments: MOCK_ASSESSMENTS,
    isLoading: false,
    error: null,
  },
};

/** The assessment opened from Recent Assessments is ringed and announced as current. */
export const SelectedAssessment: Story = {
  args: {
    assessments: MOCK_ASSESSMENTS,
    isLoading: false,
    error: null,
    selectedItem: MOCK_ASSESSMENTS[0].id,
  },
};

export const Loading: Story = {
  args: {
    assessments: [],
    isLoading: true,
    error: null,
  },
};

export const Empty: Story = {
  args: {
    assessments: [],
    isLoading: false,
    error: null,
  },
};

export const DataError: Story = {
  args: {
    assessments: [],
    isLoading: false,
    error: new Error("Indexer unreachable"),
  },
};

export const DomainRecords: Story = {
  args: {
    assessments: [
      {
        ...MOCK_ASSESSMENTS[0],
        domain: 0,
        title: "Reliable solar power for every household in the garden community",
      },
      { ...MOCK_ASSESSMENTS[0], id: "agro-record", domain: 1, title: "Native canopy returns" },
      { ...MOCK_ASSESSMENTS[1], domain: 2 },
      {
        ...MOCK_ASSESSMENTS[1],
        id: "waste-record",
        domain: 3,
        title: "Community compost and cleaner waterways",
      },
    ],
    isLoading: false,
    error: null,
  },
};
