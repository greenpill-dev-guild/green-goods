import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS, daysAgo } from "../../../../../shared/.storybook/fixtures";
import { PoolQueuedRows } from "./PoolQueuedRows";
import { storyPoolConsole } from "./poolStoryFixtures";

const QUEUED = {
  jobId: "job-queued",
  chainId: 42161,
  poolId: "7",
  direction: "OFFER" as const,
  title: "Seed library shelves",
  unitLabel: "shelves",
  targetUnits: "3",
  waitingForMembership: false,
  discardable: true,
  failed: false,
  createdAt: daysAgo(0) * 1000,
};

const meta: Meta<typeof PoolQueuedRows> = {
  title: "Admin/Pool/PoolQueuedRows",
  component: PoolQueuedRows,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Creations still queued on this device, above Offers and Requests' indexed rows, so a seeded promise shows up before the indexer has it. Nothing in the admin sends a queued creation on its own, so each row offers the send and, where the queue allows it, the way out (Discard), and leads its line with the act in flight, then why it cannot go, else how much it promises.",
      },
    },
  },
  args: {
    console: storyPoolConsole(),
    rows: [QUEUED],
    now: STORYBOOK_NOW_SECONDS * 1000,
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolQueuedRows>;

/** Not sent yet: Send Now and Discard, and the units it promises. */
export const NotSent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Seed library shelves")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Send Now" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Discard" })).toBeEnabled();
  },
};

/** Its send gave up: Try Again in Send Now's place. */
export const SendFailed: Story = {
  args: { rows: [{ ...QUEUED, failed: true }] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Try Again" })).toBeEnabled();
  },
};

/** A send that may already be on chain can't be thrown away: no Discard. */
export const MaybeSent: Story = {
  args: { rows: [{ ...QUEUED, discardable: false, hasRecordedSend: true }] },
};
