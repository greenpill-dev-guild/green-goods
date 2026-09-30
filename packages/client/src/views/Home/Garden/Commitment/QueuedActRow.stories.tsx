import type { PendingCommitmentAct } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { QueuedActRow } from "./QueuedActRow";

const claim: PendingCommitmentAct = {
  jobId: "job-claim-1",
  kind: "claim",
  waitingReason: null,
  discardable: true,
  createdAt: 1_758_800_000_000,
};

/**
 * An act taken on this phone that has not reached the chain, drawn where the act bar would be.
 * It names the act, says why it waits, and offers Send Now and, when the send never left, Discard.
 * A send on record says it is waiting for the network and offers Check Again instead.
 */
const meta: Meta<typeof QueuedActRow> = {
  title: "Client/Commitments/QueuedActRow",
  component: QueuedActRow,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "padded" },
  globals: { viewport: { value: "mobile" } },
  args: {
    act: claim,
    isBusy: false,
    onSendNow: fn(),
    onDiscard: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof QueuedActRow>;

export const WaitingToSend: Story = {};

export const WaitingForMembership: Story = {
  args: { act: { ...claim, waitingReason: "membership-unavailable" } },
};

export const ProofAlreadyBroadcast: Story = {
  args: {
    act: {
      ...claim,
      jobId: "job-evidence-1",
      kind: "evidence",
      waitingReason: "awaiting-confirmation",
      discardable: false,
    },
    onDiscard: null,
  },
};

export const NeverReachedTheNetwork: Story = {
  args: { act: { ...claim, waitingReason: "send-intent-expired" } },
};

export const Sending: Story = {
  args: { isBusy: true },
};
