import type { PendingCommitmentAct } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
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
 *
 * A wallet reader has no background flush, so their stories (`sendsFromTap`) never say the act
 * sends itself: they say why the last send failed, when one did, and that it waits for them.
 */
const meta: Meta<typeof QueuedActRow> = {
  title: "Client/Commitments/QueuedActRow",
  component: QueuedActRow,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
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

/**
 * A wallet reader who declined the wallet's network switch. The queue marks the act as it marks a
 * declined signature, and the row names the network the act needed instead of a cancelled signature.
 */
export const WalletNotSentWrongNetwork: Story = {
  args: {
    sendsFromTap: true,
    act: {
      ...claim,
      waitingReason: "send-intent-expired",
      sendFailure: {
        messageId: "app.errors.wallet.wrongNetwork.message",
        values: { network: "Arbitrum One" },
        walletNetwork: true,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        "Your wallet needs to be on Arbitrum One for this. Switch it there, then try again."
      )
    ).toBeVisible();
    await expect(canvas.queryByText(/signature cancelled/i)).toBeNull();
    // Nothing sends it for them, so the row must not say it will.
    await expect(canvas.queryByText(/sends when you're connected/i)).toBeNull();
    await expect(canvas.getByRole("button", { name: "Send Now" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Discard" })).toBeEnabled();
  },
};

/** A wallet reader whose last send failed for another reason: the row says which kind. */
export const WalletNotSentConnection: Story = {
  args: {
    sendsFromTap: true,
    act: { ...claim, sendFailure: { messageId: "app.errors.blockchain.network.message" } },
  },
};

/** A wallet reader's act that has not been tried yet: it waits for their own send. */
export const WalletNotSentYet: Story = {
  args: { sendsFromTap: true },
};

/** A wallet reader waiting for their membership: it is theirs to send once it lands. */
export const WalletWaitingForMembership: Story = {
  args: { sendsFromTap: true, act: { ...claim, waitingReason: "membership-unavailable" } },
};
