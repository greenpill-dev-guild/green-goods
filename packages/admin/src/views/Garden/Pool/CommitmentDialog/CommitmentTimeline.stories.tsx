import type { Meta, StoryObj } from "@storybook/react";
import { daysAgo } from "../../../../../../shared/.storybook/fixtures";
import { STORY_JOAO, storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentTimeline } from "./CommitmentTimeline";

const dialog = storyCommitmentDialog();
const [latest] = dialog.events;

const meta: Meta<typeof CommitmentTimeline> = {
  title: "Admin/Pool/CommitmentTimeline",
  component: CommitmentTimeline,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Everything that has happened to a commitment, newest first, in the words a member would use. Steward language never appears here: a dispute reads as a review.",
      },
    },
  },
  args: { events: dialog.events },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentTimeline>;

export const Recorded: Story = {};

export const ReviewedAndKept: Story = {
  args: {
    events: [
      { ...latest, id: "e-6", eventType: "FULFILLED", actor: STORY_JOAO, timestamp: daysAgo(0) },
      {
        ...latest,
        id: "e-5",
        eventType: "DISPUTE_RESOLVED",
        actor: STORY_JOAO,
        timestamp: daysAgo(1),
      },
      { ...latest, id: "e-4", eventType: "DISPUTED", actor: STORY_JOAO, timestamp: daysAgo(2) },
      ...dialog.events,
    ],
  },
};

export const NothingYet: Story = {
  args: { events: [] },
};
