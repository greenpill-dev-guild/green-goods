import type { Address, Work, WorkMetadata } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { daysAgo, FIXTURE_IMAGE_AGROFORESTRY } from "../../../../../shared/.storybook/fixtures";
import { SubmissionDetails } from "./SubmissionDetails";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

const BASE_WORK: Work = {
  id: "work-1",
  title: "Planted 50 native saplings",
  actionUID: 42,
  gardenerAddress: GARDENER,
  gardenAddress: GARDEN,
  feedback: "",
  metadata: "{}",
  media: [FIXTURE_IMAGE_AGROFORESTRY],
  createdAt: daysAgo(2),
  status: "pending",
};

const METADATA: Partial<WorkMetadata> = {
  schemaVersion: "work_metadata_v2",
  actionSlug: "agro.planting_event",
  timeSpentMinutes: 120,
  details: {
    plantCount: 50,
    species: "Cabralea canjerana",
    siteConditions: "Post-rain, ~21°C",
  },
  tags: ["rainforest", "native", "first-year"],
};

const meta: Meta<typeof SubmissionDetails> = {
  title: "Admin/Workflows/Hub/SubmissionDetails",
  component: SubmissionDetails,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Read-only submission-detail panel inside the work review sheet. Shows action, garden, gardener, timestamp, metadata, and optional gardener feedback.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    work: BASE_WORK,
    gardenName: "Rio Rainforest Lab",
    actionTitle: "Planting event",
    actionSlug: "agro.planting_event",
    metadata: METADATA,
  },
};

export default meta;
type Story = StoryObj<typeof SubmissionDetails>;

export const WithMetadata: Story = {};

export const WithoutMetadata: Story = {
  args: {
    metadata: null,
  },
};

export const WithFeedback: Story = {
  args: {
    work: {
      ...BASE_WORK,
      feedback: "Session ran long but all seedlings are in place. Noted light stress on 3 plants.",
    },
  },
};

export const UnresolvedAction: Story = {
  args: {
    actionTitle: undefined,
    actionSlug: undefined,
  },
};
