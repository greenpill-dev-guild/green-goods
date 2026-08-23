import type { Meta, StoryObj } from "@storybook/react";
import { storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentRecovery } from "./CommitmentRecovery";

const dialog = storyCommitmentDialog();

const meta: Meta<typeof CommitmentRecovery> = {
  title: "Admin/Pool/CommitmentRecovery",
  component: CommitmentRecovery,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "What a steward can do while a commitment sits accepted and the ordinary path has stalled: mark it ready, attach the assessment it waits on, or call it off. Each act records a reason, and the member reads that reason rather than the bare state. The override reads differently for a proof-only record than for a Work-backed one, but both are offered it.",
      },
    },
  },
  args: {
    evidenceOnly: true,
    can: dialog.can,
    actDisabled: false,
    onOpenDialog: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentRecovery>;

export const RecipientCannotConfirm: Story = {};

export const AssessmentRequired: Story = {
  args: {
    evidenceOnly: false,
    can: { ...dialog.can, attachAssessment: true },
  },
};

/**
 * A Work-backed record whose requirements stalled. The override is the only
 * recovery the chain offers it, so the row is here too — in its own words.
 */
export const WorkBacked: Story = {
  args: { evidenceOnly: false },
};

export const Offline: Story = {
  args: { actDisabled: true },
};
