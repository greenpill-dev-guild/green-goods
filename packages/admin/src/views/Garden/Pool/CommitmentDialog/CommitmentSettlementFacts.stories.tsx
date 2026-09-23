import type { Meta, StoryObj } from "@storybook/react";
import { storyCommitmentSettlement, storySettlementPlan } from "../poolStorySettlement";
import { CommitmentSettlementFacts } from "./CommitmentSettlementFacts";

const meta: Meta<typeof CommitmentSettlementFacts> = {
  title: "Admin/Pool/CommitmentSettlementFacts",
  component: CommitmentSettlementFacts,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Who pays whom how much, and whether the destination, cap, fees and route are ready, from the controller's chain and funding reads.",
      },
    },
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
type Story = StoryObj<typeof CommitmentSettlementFacts>;

export const BeforePlan: Story = { args: { settlement: storyCommitmentSettlement() } };

export const WithPlan: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        payoutPlanId: 7n,
        plan: storySettlementPlan({ finalized: true, status: "PENDING" }),
      },
    }),
  },
};

export const InactiveBeneficiary: Story = {
  args: {
    settlement: storyCommitmentSettlement({
      chain: {
        beneficiaryAccount: {
          account: "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37",
          active: false,
          chainId: 42220,
        },
      },
    }),
  },
};
