import { VOUCHER_START_IDLE } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../../../shared/.storybook/decorators";
import { VoucherStartList } from "./VoucherStartList";

const HASH = (byte: string) => `0x${byte.repeat(32)}` as const;
const ACCEPTED = { status: "confirmed", key: "accept", hash: HASH("a1") } as const;

const meta: Meta<typeof VoucherStartList> = {
  title: "Admin/Pool/VoucherStartList",
  component: VoucherStartList,
  tags: ["autodocs", "storybook-ci"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "Accept and Start's three sends (DL-193), in the Accept dialog of Review Promises: the acceptance, then the booking's start recorded on Arbitrum and sent to the voucher network on Gnosis. Each is its own approval in the steward's wallet. The steward reads the list, with the start's network fee, before confirming, and watches it fill in. The people, addresses and moments are fictional.",
      },
    },
  },
  args: {
    accept: { status: "idle" },
    start: VOUCHER_START_IDLE,
    estimatedFee: 41_000_000_000_000n,
    name: "Kwesi",
    chainId: 42161,
  },
};

export default meta;
type Story = StoryObj<typeof VoucherStartList>;

const statuses = (canvas: HTMLElement) =>
  within(canvas)
    .getAllByRole("listitem")
    .map((row) => row.dataset.status);

/** Before confirming: three approvals, and the start's network fee from the booking's quote. */
export const BeforeTheRun: Story = {
  play: async ({ canvasElement }) => {
    await expect(statuses(canvasElement)).toEqual(["waiting", "waiting", "waiting"]);
    await expect(
      within(canvasElement).getByText("Tells the voucher network. Network fee: about 0.000041 ETH.")
    ).toBeVisible();
  },
};

/** Accepted and recorded; the send to the voucher network is with the wallet, at its own quote. */
export const Sending: Story = {
  args: {
    accept: ACCEPTED,
    start: {
      record: "done",
      send: "signing",
      fee: 38_000_000_000_000n,
      hashes: { record: HASH("b1"), send: null },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(statuses(canvasElement)).toEqual(["done", "done", "signing"]);
    await expect(within(canvasElement).getByText(/about 0\.000038 ETH/)).toBeVisible();
  },
};

/** The start didn't go: the acceptance stands, and the member's fallback covers the start. */
export const StartFailed: Story = {
  args: {
    accept: ACCEPTED,
    start: { ...VOUCHER_START_IDLE, record: "failed" },
  },
  play: async ({ canvasElement }) => {
    await expect(statuses(canvasElement)).toEqual(["done", "failed", "waiting"]);
    await expect(within(canvasElement).getByText("Didn’t go through")).toBeVisible();
  },
};

/** The acceptance is a Safe proposal: nothing starts until its signers approve it. */
export const WaitingOnSafe: Story = {
  args: { accept: { status: "safe-signers", key: "accept" } },
  play: async ({ canvasElement }) => {
    await expect(statuses(canvasElement)).toEqual(["waitingOnSafe", "waiting", "waiting"]);
  },
};
