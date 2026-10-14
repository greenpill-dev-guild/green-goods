import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Meta, StoryObj } from "@storybook/react";
import { storyCommitment } from "../poolStoryFixtures";
import { CommitmentSummary } from "./CommitmentSummary";
import { stageIndex } from "./commitmentDialogPresentation";

/** Keep each story's lifecycle marker honest against the record it shows. */
function atStage(commitment: CommitmentReadModel) {
  return { commitment, stage: stageIndex(commitment.onchainState, commitment.evidenceCount) };
}

const meta: Meta<typeof CommitmentSummary> = {
  title: "Admin/Pool/CommitmentSummary",
  component: CommitmentSummary,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A commitment's identity at the head of the panel: what kind of thing it is, who it is between, what it asks for, and how far along the five lifecycle stops it stands.",
      },
    },
  },
  args: {
    ...atStage(storyCommitment({ evidenceCount: 2, targetUnits: 1n, unitLabel: "repair session" })),
    title: "Repair tool handles",
    note: "One Saturday session at the tool library.",
    isDue: false,
    fallbackPath: null,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl space-y-3 p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentSummary>;

export const ProofIn: Story = {};

export const PastDue: Story = {
  args: {
    ...atStage(storyCommitment({ targetUnits: 16n, unitLabel: "rides" })),
    title: "Market rides",
    note: null,
    isDue: true,
  },
};

export const OrdinaryUnreachable: Story = {
  args: {
    ...atStage(
      storyCommitment({
        onchainState: "READY_FOR_CONFIRMATION",
        derivedState: "READY_FOR_CONFIRMATION",
        state: "READY_FOR_CONFIRMATION",
        evidenceCount: 2,
      })
    ),
    fallbackPath: "POOL_FALLBACK",
  },
};

export const Kept: Story = {
  args: {
    ...atStage(
      storyCommitment({
        onchainState: "FULFILLED",
        derivedState: "FULFILLED",
        state: "FULFILLED",
        evidenceCount: 2,
        confirmationCount: 1,
      })
    ),
  },
};
