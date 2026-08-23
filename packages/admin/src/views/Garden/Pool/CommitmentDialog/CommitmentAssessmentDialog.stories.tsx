import type { CommitmentDialogController } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { daysAgo } from "../../../../../../shared/.storybook/fixtures";
import { STORY_GARDEN, STORY_MARIA, storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentAssessmentDialog } from "./CommitmentAssessmentDialog";

/** The picker is controlled; the story holds the reader's pick. */
function CommitmentAssessmentDialogWithPick(
  props: ComponentProps<typeof CommitmentAssessmentDialog>
) {
  const [assessmentUID, setAssessmentUID] = useState<string | null>(props.assessmentUID);
  return (
    <CommitmentAssessmentDialog
      {...props}
      assessmentUID={assessmentUID}
      onAssessmentUIDChange={setAssessmentUID}
    />
  );
}

const STORY_ASSESSMENTS: CommitmentDialogController["assessments"] = [
  {
    id: "0x9a1c4f0e5b2d47c8a0f3e6b91d5c72a8f4e0b6c39d18a752e4c0b93f6a1d820c",
    authorAddress: STORY_MARIA,
    gardenAddress: STORY_GARDEN,
    title: "Tool library condition survey",
    description: "Bench, handles and blades checked before the winter repair sessions.",
    assessmentConfigCID: "bafy-assessment-tools",
    domain: 1,
    startDate: daysAgo(120),
    endDate: daysAgo(96),
    location: "Rocinha tool library",
    createdAt: daysAgo(96),
  },
  {
    id: "0x2b7e08d3c9145af6021d8e7b34c05fa9e18d62b407c93f15a8d0e64b29c7135f",
    authorAddress: STORY_MARIA,
    gardenAddress: STORY_GARDEN,
    title: "North beds soil and canopy baseline",
    description: "Soil depth, shade cover and species counts across the north beds.",
    assessmentConfigCID: "bafy-assessment-beds",
    domain: 0,
    startDate: daysAgo(60),
    endDate: daysAgo(45),
    location: "North beds",
    createdAt: daysAgo(45),
  },
];

const meta: Meta<typeof CommitmentAssessmentDialog> = {
  title: "Admin/Pool/CommitmentAssessmentDialog",
  component: CommitmentAssessmentDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Attaching the assessment a commitment waits on. Only current assessments recorded for the provider garden are on offer, and attaching one vouches that it applies to this commitment.",
      },
    },
  },
  args: {
    open: "attach-assessment",
    onClose: () => undefined,
    tone: "garden",
    acts: storyCommitmentDialog().acts,
    assessments: STORY_ASSESSMENTS,
    assessmentsLoading: false,
    assessmentUID: null,
    onAssessmentUIDChange: () => undefined,
    actDisabled: false,
    isActing: false,
  },
  render: (args) => <CommitmentAssessmentDialogWithPick {...args} />,
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentAssessmentDialog>;

export const Choosing: Story = {};

export const NothingRecordedYet: Story = {
  args: { assessments: [] },
};

export const Loading: Story = {
  args: { assessmentsLoading: true },
};
