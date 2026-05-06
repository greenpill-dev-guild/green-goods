import type { Meta, StoryObj } from "@storybook/react";
import { withRouter } from "../../../../shared/.storybook/decorators";
import { GardenAssessmentsPanel } from "./GardenAssessmentsPanel";

const MOCK_ASSESSMENTS = [
  {
    id: "0xabc0000000000000000000000000000000000000000000000000000000000001",
    title: "Q1 restoration survey",
    assessmentType: "impact",
    createdAt: 1712534400,
  },
  {
    id: "0xabc0000000000000000000000000000000000000000000000000000000000002",
    title: "Workshop cohort check-in",
    assessmentType: "education",
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
