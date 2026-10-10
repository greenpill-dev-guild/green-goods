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
    reconciliation: dialog.reconciliation,
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
  args: {
    actDisabled: true,
    can: { ...dialog.can, syncWorkDecisions: true },
    reconciliation: { ...dialog.reconciliation, count: 1 },
  },
};

export const ApprovedWorkWaiting: Story = {
  args: {
    can: { ...dialog.can, syncWorkDecisions: true },
    reconciliation: {
      ...dialog.reconciliation,
      count: 2,
      decisionUIDs: [`0x${"ab".repeat(32)}`, `0x${"cd".repeat(32)}`],
    },
  },
};

export const WaitingForIndexedReadback: Story = {
  args: {
    reconciliation: { ...dialog.reconciliation, readbackStatus: "pending", pendingReadback: true },
  },
};

export const Reconciled: Story = {
  args: {
    reconciliation: { ...dialog.reconciliation, readbackStatus: "succeeded", succeeded: true },
  },
};

export const NeedsFreshReview: Story = {
  args: {
    reconciliation: { ...dialog.reconciliation, readbackStatus: "needsFreshReview" },
  },
};

export const DecisionReadUnavailable: Story = {
  args: {
    reconciliation: {
      ...dialog.reconciliation,
      readAvailable: false,
      isError: true,
      readbackStatus: "unavailable",
      error: new Error("Story decision read unavailable"),
    },
  },
};
