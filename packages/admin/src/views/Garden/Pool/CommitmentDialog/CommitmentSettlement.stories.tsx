import type { Meta, StoryObj } from "@storybook/react";
import {
  storyCommitmentSettlement,
  storySettlementDisbursement,
  storySettlementPlan,
} from "../poolStorySettlement";
import { CommitmentSettlement } from "./CommitmentSettlement";

const meta: Meta<typeof CommitmentSettlement> = {
  title: "Admin/Pool/CommitmentSettlement",
  component: CommitmentSettlement,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The G$ payout for one fulfilled, priced commitment: who pays whom how much, the settlement module's own sequence with its current step, the one act it accepts next behind a review, and every child disbursement with the acts its state still allows.",
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
type Story = StoryObj<typeof CommitmentSettlement>;

export const ReadyToCreatePlan: Story = {
  args: { settlement: storyCommitmentSettlement() },
};

export const PlanDraft: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: { payoutPlanId: 7n, plan: storySettlementPlan() },
    }),
  },
};

export const ReadyToPrepare: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: storySettlementPlan({ finalized: true, status: "PENDING" }),
      },
    }),
  },
};

export const QueuedForDispatch: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: storySettlementPlan({
          finalized: true,
          status: "PENDING",
          beneficiaryDisbursementId: 40n,
          preparedPayoutCount: 1,
        }),
        disbursements: [storySettlementDisbursement()],
      },
    }),
  },
};

export const AwaitingAcknowledgement: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: storySettlementPlan({
          finalized: true,
          status: "PENDING",
          beneficiaryDisbursementId: 40n,
          preparedPayoutCount: 1,
        }),
        disbursements: [
          storySettlementDisbursement({
            state: "DISPATCHED",
            attempt: 1,
            dispatchedAt: 1_756_000_000,
            acknowledgmentPending: true,
          }),
        ],
      },
    }),
  },
};

export const Complete: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: storySettlementPlan({
          finalized: true,
          status: "COMPLETE",
          beneficiaryDisbursementId: 40n,
          preparedPayoutCount: 1,
          confirmedPayoutCount: 1,
        }),
        disbursements: [storySettlementDisbursement({ state: "CONFIRMED", attempt: 1 })],
      },
    }),
  },
};

export const MemberPayoutBlockedByDeliveryGate: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        kind: "CONTRIBUTOR_CONSIDERATION",
        payoutPlanId: 8n,
        plan: storySettlementPlan({
          payoutPlanId: 8n,
          payoutKind: "CONTRIBUTOR_CONSIDERATION",
          finalized: true,
          status: "PENDING",
          beneficiaryGarden: null,
          beneficiaryRecipient: null,
          beneficiaryAmount: 0n,
          contributorPayoutTotal: 250n * 10n ** 18n,
        }),
        rows: [
          {
            contributor: "0x1111111111111111111111111111111111111111",
            recipient: "0x1111111111111111111111111111111111111111",
            amount: 250n * 10n ** 18n,
            recognitionWeightBps: 10_000,
            paymentWeightBps: 10_000,
            disbursementId: null,
          },
        ],
        gardenerDeliveryEnabled: false,
      },
    }),
  },
};

export const MissingRole: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      authority: {
        isPayerSteward: false,
        canDispatchOrRetry: false,
        canRequeueOrCancel: false,
        resolved: true,
      },
    }),
  },
};

export const Ineligible: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      eligibility: { eligible: false, kind: null, blockers: ["no-celo-consideration"] },
    }),
  },
};
