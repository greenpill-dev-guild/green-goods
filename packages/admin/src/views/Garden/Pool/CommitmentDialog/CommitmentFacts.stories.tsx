import type { Meta, StoryObj } from "@storybook/react";
import {
  STORY_ANA,
  STORY_JOAO,
  storyCommitment,
  storyCommitmentDialog,
} from "../poolStoryFixtures";
import { CommitmentFacts } from "./CommitmentFacts";

const dialog = storyCommitmentDialog();

const meta: Meta<typeof CommitmentFacts> = {
  title: "Admin/Pool/CommitmentFacts",
  component: CommitmentFacts,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A commitment's checkable facts: what was promised, what proof stands behind it, who may confirm it, and once it is kept, who did and on what authority.",
      },
    },
  },
  args: {
    commitment: storyCommitment({ evidenceCount: 2, targetUnits: 1n, unitLabel: "repair session" }),
    detail: dialog.detail,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentFacts>;

export const Accepted: Story = {};

export const NamedConfirmers: Story = {
  args: {
    commitment: storyCommitment({
      evidenceCount: 2,
      confirmers: [STORY_JOAO, STORY_ANA],
      confirmationThreshold: 2,
      protocolFallbackEnabled: false,
    }),
  },
};

export const ConfirmedOrdinary: Story = {
  args: {
    commitment: storyCommitment({
      onchainState: "FULFILLED",
      derivedState: "FULFILLED",
      state: "FULFILLED",
      evidenceCount: 2,
      confirmationCount: 1,
      fulfilledBy: STORY_JOAO,
      confirmationPath: "ORDINARY",
    }),
  },
};

export const ConfirmedByGardenFallback: Story = {
  args: {
    commitment: storyCommitment({
      onchainState: "FULFILLED",
      derivedState: "FULFILLED",
      state: "FULFILLED",
      evidenceCount: 2,
      confirmationCount: 1,
      readyOverridden: true,
      confirmationPath: "POOL_FALLBACK",
      fallbackReason: "Confirmed on a site visit; the recipient has no device.",
    }),
  },
};
