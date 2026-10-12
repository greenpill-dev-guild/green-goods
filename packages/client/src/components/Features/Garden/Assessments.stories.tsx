import type { GardenAssessmentRecord } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import { Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { daysAgo, STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import { GardenAssessments } from "./Assessments";

const TITLES = {
  [Domain.SOLAR]: "Reliable solar power for households in the garden community",
  [Domain.AGRO]: "Native canopy returns along the riverbank",
  [Domain.EDU]: "Gardeners learn to restore and care for their soil",
  [Domain.WASTE]: "Community compost and cleaner waterways",
};

function record(domain: Domain): GardenAssessmentRecord {
  return {
    summary: {
      id: `assessment-${domain}`,
      authorAddress: "0x0000000000000000000000000000000000000002",
      gardenAddress: "0x0000000000000000000000000000000000000001",
      title: TITLES[domain],
      description: "A community-led assessment of the changes made during this reporting period.",
      assessmentConfigCID: "",
      domain,
      startDate: daysAgo(90),
      endDate: STORYBOOK_NOW_SECONDS,
      location: "Community garden",
      createdAt: STORYBOOK_NOW_SECONDS,
    },
    detail: {
      status: "loaded",
      value: {
        diagnosis: "The community needs to understand which changes are lasting.",
        smartOutcomes: [],
        cynefinPhase: 2,
        selectedActionUIDs: [],
        sdgTargets: [13],
        evidenceCids: [],
      },
    },
  };
}

const meta = {
  title: "Client/Garden/Assessments",
  component: GardenAssessments,
  tags: ["autodocs"],
  decorators: [
    withRouter(["/home/garden-id"]),
    (Story) => (
      <div className="max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  args: { records: [record(Domain.AGRO)], assessmentFetchStatus: "success" },
} satisfies Meta<typeof GardenAssessments>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Solar: Story = { args: { records: [record(Domain.SOLAR)] } };
export const Education: Story = { args: { records: [record(Domain.EDU)] } };
export const Waste: Story = { args: { records: [record(Domain.WASTE)] } };
export const Loading: Story = { args: { records: [], assessmentFetchStatus: "pending" } };
export const Empty: Story = { args: { records: [] } };
export const DataError: Story = { args: { records: [], assessmentFetchStatus: "error" } };
export const DetailUnavailable: Story = {
  args: { records: [{ ...record(Domain.EDU), detail: { status: "unavailable" } }] },
};
