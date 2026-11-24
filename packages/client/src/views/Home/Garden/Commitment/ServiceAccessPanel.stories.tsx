import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ServiceAccessPanel } from "./ServiceAccessPanel";
import { serviceAccessStorySnapshot } from "./serviceAccessStoryFixtures";

const snapshot = serviceAccessStorySnapshot();
const meta: Meta<typeof ServiceAccessPanel> = {
  title: "Client/Commitments/ServiceAccessPanel",
  component: ServiceAccessPanel,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    snapshot,
    isPending: false,
    onRefresh: fn(),
    onAction: fn().mockResolvedValue({
      kind: "local-rehearsal",
      observationId: "storybook-presentation-only",
      snapshot,
    }),
  },
};
export default meta;
type Story = StoryObj<typeof ServiceAccessPanel>;
export const ReviewRequest: Story = {};
export const ActiveWithPendingAcknowledgment: Story = {
  args: { snapshot: serviceAccessStorySnapshot(true) },
};
export const LiveUnavailable: Story = {
  args: {
    snapshot: {
      ...snapshot,
      availableActions: [],
      evidence: "onchain",
      capabilities: {
        ...snapshot.capabilities,
        mutation: "unavailable",
        reasons: ["deployment-unreviewed"],
      },
    },
  },
};
export const FrozenPartialAllocation: Story = {
  args: {
    snapshot: (() => {
      const state = serviceAccessStorySnapshot(true);
      state.voucherSetups[0].destination!.finalAllocation = {
        decisionId: state.offer!.termsHash,
        activationDecisionId: state.voucherSetups[0].source.decisionId!,
        issuerReturnApprovalAtFreeze: 60n,
        allocation: {
          approvedDeliveredServiceUnits: 3n,
          releaseVoucherUnits: 40n,
          refundVoucherUnits: 60n,
        },
        release: { state: "failed", attempts: 1n, failureHash: state.offer!.termsHash },
        refund: { state: "pending", attempts: 0n, failureHash: null },
        financiallyClosed: false,
      };
      state.voucherSetups[0].availableActions = [
        "executeVoucherFinalLeg",
        "retryVoucherSetupAcknowledgment",
      ];
      return state;
    })(),
  },
};
