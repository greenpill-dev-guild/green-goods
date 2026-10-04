import {
  claimRowKey,
  type WaitingRow,
} from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { STORY_CLAIMS, STORY_NOW } from "./poolStoryFixtures";
import { WaitingForApprovalRow } from "./WaitingForApprovalRow";

const ROW = STORY_CLAIMS[0]!;
const KEY = claimRowKey(ROW);
const AT = Number(STORY_NOW) * 1000;

function item(state: WaitingRow["state"], phase: WaitingRow["phase"] = { status: "idle" }) {
  return { key: KEY, row: ROW, phase, state } satisfies WaitingRow;
}

const meta: Meta<typeof WaitingForApprovalRow> = {
  title: "Admin/Pool/WaitingForApprovalRow",
  component: WaitingForApprovalRow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One ask in Review Promises (PRD-1025 D6): who asked and when, then what for, in a row that keeps one height through every state. The acts, the progress and the outcome all take the same slot on the right; every name uses one style, and the age gives way before the name does.",
      },
    },
  },
  args: {
    item: item({ status: "waiting", isNew: false }),
    title: "Ride to the market on Saturday",
    chainId: ROW.claim.chainId,
    paused: false,
    disabled: false,
    onOpen: () => undefined,
    onApprove: () => undefined,
    onDecline: () => undefined,
  },
  decorators: [
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <ul className="max-w-md divide-y divide-stroke-soft p-4" data-tone="garden">
        <Story />
      </ul>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WaitingForApprovalRow>;

export const Waiting: Story = {};

export const New: Story = { args: { item: item({ status: "waiting", isNew: true }) } };

export const WithTheWallet: Story = {
  args: { item: item({ status: "signing" }, { status: "signing", key: KEY }) },
};

export const Confirming: Story = {
  args: {
    item: item(
      { status: "confirming" },
      { status: "confirming", key: KEY, hash: `0x${"a".repeat(64)}` }
    ),
  },
};

export const DidNotGoThrough: Story = {
  args: { item: item({ status: "failed" }, { status: "failed", key: KEY }) },
};

export const Approved: Story = { args: { item: item({ status: "approved", at: AT }) } };

export const NotChosen: Story = { args: { item: item({ status: "not-chosen", at: AT }) } };

export const Declined: Story = { args: { item: item({ status: "declined", at: AT }) } };

/** It left the list with no decision here: settled from somewhere else. */
export const NoLongerWaiting: Story = { args: { item: item({ status: "gone" }) } };

/** A long title is cut to one line; the promise the row opens has it in full. */
export const LongTitle: Story = {
  args: {
    title:
      "Ride to the market on Saturday morning with the seedling trays, the compost bags and the two wheelbarrows",
  },
};

export const Paused: Story = { args: { paused: true } };
