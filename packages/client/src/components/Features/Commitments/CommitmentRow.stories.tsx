import type { Address } from "@green-goods/shared";
import type { CommitmentReadModel, InboxCommitment } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { CommitmentRow } from "./CommitmentRow";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    unitLabel: "hours",
    creator: VIEWER,
    leadProvider: VIEWER,
    counterparty: OTHER,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

function row(overrides: Partial<InboxCommitment> = {}): InboxCommitment {
  return { commitment: commitment(), seat: "provider", needsYou: true, ...overrides };
}

/**
 * One commitment as a member sees it in their own list: what it is, which
 * side they are on, where it stands, and whether it is waiting on them.
 */
const meta: Meta<typeof CommitmentRow> = {
  title: "Client/Commitments/CommitmentRow",
  component: CommitmentRow,
  tags: ["autodocs", "storybook-ci"],
  parameters: { viewport: { defaultViewport: "mobile1" } },
  decorators: [
    (Story) => (
      <div className="max-w-sm space-y-2 p-4">
        <Story />
      </div>
    ),
  ],
  args: { onOpen: fn() },
};

export default meta;
type Story = StoryObj<typeof CommitmentRow>;

export const ProviderNeedsYou: Story = {
  args: { row: row() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /3 hours/ })).toBeVisible();
    await expect(canvas.getByText("Needs you")).toBeVisible();
  },
};

export const Named: Story = {
  args: { row: row(), title: "Compost delivery to the beds" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Compost delivery to the beds")).toBeVisible();
    await expect(canvas.getByText("3 hours")).toBeVisible();
  },
};

export const ConfirmerWaiting: Story = {
  args: {
    row: row({
      commitment: commitment({
        creator: OTHER,
        leadProvider: OTHER,
        counterparty: VIEWER,
        derivedState: "READY_FOR_CONFIRMATION",
        onchainState: "READY_FOR_CONFIRMATION",
        evidenceCount: 2,
      }),
      seat: "confirmer",
      needsYou: true,
    }),
  },
};

export const OnTheTeam: Story = {
  args: {
    row: row({
      commitment: commitment({ creator: OTHER, leadProvider: OTHER, contributorCount: 3 }),
      seat: "contributor",
      needsYou: false,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3 people on the team")).toBeVisible();
  },
};

export const SendFailed: Story = {
  args: { row: row({ needsYou: false }), sendFailed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Didn't send")).toBeVisible();
  },
};

export const Settled: Story = {
  args: {
    row: row({
      commitment: commitment({ derivedState: "FULFILLED", onchainState: "FULFILLED" }),
      needsYou: false,
    }),
  },
};

/** Without a destination the row is a record, not a control. */
export const RecordOnly: Story = {
  args: { row: row({ needsYou: false }), onOpen: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
