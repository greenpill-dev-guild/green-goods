import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ServiceIssuerPanel } from "./ServiceIssuerPanel";
import {
  ISSUER_STORY_HASH,
  issuerStoryAssets,
  issuerStoryReview,
  issuerStorySnapshot,
} from "./serviceIssuerStoryFixtures";

const meta: Meta<typeof ServiceIssuerPanel> = {
  title: "Client/Profile/ServiceIssuerPanel",
  component: ServiceIssuerPanel,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-xs text-text-sub-600">
          Fictional Storybook data. No transactions are sent.
        </p>
        <Story />
      </div>
    ),
  ],
  args: {
    snapshot: issuerStorySnapshot(),
    assets: issuerStoryAssets,
    onRefresh: fn().mockResolvedValue(undefined),
    onReview: fn(async (action) => issuerStoryReview(action)),
    onExecute: fn().mockResolvedValue({
      status: "confirmed",
      transactionHash: ISSUER_STORY_HASH,
      currentStateMatchesReceipt: true,
    }),
    onReconcile: fn().mockResolvedValue(null),
    onQuote: fn(async ({ outputAssetId, amount }) => ({
      outputAssetId,
      amount,
      quotedOutput: amount * 2n,
      grossOutput: amount * 2n,
      reservedOutputFees: 0n,
      observedAt: 1_900_000_000n,
      expiresAt: 1_900_000_300n,
    })),
  },
};
export default meta;
type Story = StoryObj<typeof ServiceIssuerPanel>;
export const Issuer: Story = {};
export const Holder: Story = {
  args: {
    snapshot: {
      ...issuerStorySnapshot(),
      actor: {
        ...issuerStorySnapshot().actor,
        address: "0x6666666666666666666666666666666666666666",
      },
      holdingBalance: 500_000n,
    },
  },
};
export const Unconfigured: Story = {
  args: { snapshot: { evidence: "unavailable", reason: "unconfigured" } },
};
export const Loading: Story = { args: { snapshot: undefined, isLoading: true } };
export const ReadError: Story = { args: { snapshot: undefined, isError: true } };
export const Pending: Story = {
  args: {
    snapshot: {
      ...issuerStorySnapshot(),
      pending: {
        version: 1,
        actor: issuerStorySnapshot().actor,
        review: issuerStoryReview({ kind: "revokeReserve" }),
      },
    },
  },
};
export const FrozenPartialDelivery: Story = {
  args: {
    snapshot: (() => {
      const snapshot = issuerStorySnapshot();
      snapshot.bookings.records[0].approvalEligible = false;
      snapshot.bookings.records[0].result.phase = "active";
      snapshot.bookings.records[0].result.issuerApproved = true;
      snapshot.bookings.records[0].finalAllocation = {
        decisionId: ISSUER_STORY_HASH,
        activationDecisionId: ISSUER_STORY_HASH,
        issuerReturnApprovalAtFreeze: 500_000n,
        allocation: {
          approvedDeliveredServiceUnits: 30n,
          releaseVoucherUnits: 500_000n,
          refundVoucherUnits: 500_000n,
        },
        release: { state: "failed", attempts: 1n, failureHash: ISSUER_STORY_HASH },
        refund: { state: "succeeded", attempts: 1n, failureHash: null },
        financiallyClosed: false,
      };
      return snapshot;
    })(),
  },
};
