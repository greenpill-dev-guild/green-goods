import type { FailedCommitmentJob } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { FailedActRow } from "./FailedActAlert";

const gaveUp: FailedCommitmentJob = {
  jobId: "job-evidence-1",
  discardable: true,
  reason: null,
  retryable: true,
};

/**
 * An act on a promise that gave up, drawn at the top of the promise. The icon and
 * title share a line, the body says why in two lines, and Discard and Try Again
 * run full width; each is withheld when it can't help.
 */
const meta: Meta<typeof FailedActRow> = {
  title: "Client/Commitments/FailedActAlert",
  component: FailedActRow,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    failed: gaveUp,
    isBusy: false,
    onRetry: fn(),
    onDiscard: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof FailedActRow>;

export const GaveUp: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("The send gave up");
    canvas.getByRole("button", { name: "Try Again" }).click();
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

/** A named reason stopped the act, and retrying the same payload can't help. */
export const StoppedForAReason: Story = {
  args: {
    failed: { ...gaveUp, reason: "identityConflict", retryable: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Try Again" })).toBeNull();
    await expect(canvas.getByRole("button", { name: "Discard" })).toBeVisible();
  },
};

/** The record may already be on chain, so it can't be thrown away. */
export const MayAlreadyBeOnChain: Story = {
  args: { failed: { ...gaveUp, discardable: false } },
};
