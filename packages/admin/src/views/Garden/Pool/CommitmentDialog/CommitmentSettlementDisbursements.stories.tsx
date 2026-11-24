import type { Meta, StoryObj } from "@storybook/react";
import {
  storyCommitmentSettlement,
  storySettlementDisbursement,
  storySettlementPlan,
} from "../poolStorySettlement";
import { CommitmentSettlementDisbursements } from "./CommitmentSettlementDisbursements";

const preparedPlan = storySettlementPlan({
  finalized: true,
  status: "PARTIAL",
  beneficiaryDisbursementId: 40n,
  preparedPayoutCount: 1,
});

const meta: Meta<typeof CommitmentSettlementDisbursements> = {
  title: "Admin/Pool/CommitmentSettlementDisbursements",
  component: CommitmentSettlementDisbursements,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Every child disbursement with the state the chain reports and only the acts LifecycleLib still accepts for it: dispatch a queued child, retry a dispatched one, requeue a failed one, cancel with a reason.",
      },
    },
  },
  args: { tone: "garden" },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentSettlementDisbursements>;

export const Queued: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: preparedPlan,
        disbursements: [storySettlementDisbursement()],
      },
    }),
  },
};

/** A dispatched payout Celo would refuse to take again: no resend, and the row says why. */
export const ResendHeld: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: preparedPlan,
        disbursements: [
          storySettlementDisbursement({
            state: "DISPATCHED",
            attempt: 1,
            dispatchedAt: 1_756_000_000,
          }),
        ],
      },
      transferBlock: () => "executor_paused",
    }),
  },
};

export const Failed: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: preparedPlan,
        disbursements: [
          storySettlementDisbursement({ state: "FAILED", attempt: 1, failureCode: 7 }),
        ],
      },
    }),
  },
};

export const Cancelled: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: storySettlementPlan({ ...preparedPlan, status: "FAILED", cancelledPayoutCount: 1 }),
        disbursements: [
          storySettlementDisbursement({
            state: "CANCELLED",
            attempt: 1,
            cancelledFromState: "FAILED",
          }),
        ],
      },
    }),
  },
};

export const OperatorOnly: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      authority: {
        isPayerSteward: true,
        canDispatchOrRetry: false,
        canRequeueOrCancel: false,
        resolved: true,
      },
      chain: {
        payoutPlanId: 7n,
        plan: preparedPlan,
        disbursements: [storySettlementDisbursement()],
      },
    }),
  },
};
