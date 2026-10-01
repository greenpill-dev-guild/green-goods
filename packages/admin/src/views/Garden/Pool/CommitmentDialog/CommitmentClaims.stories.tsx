import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { claimRowKey } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import {
  STORY_ANA,
  STORY_CLAIMS,
  STORY_JOAO,
  STORY_NOW,
  storyCommitmentDialog,
} from "../poolStoryFixtures";
import { CommitmentClaims, CommitmentRoster } from "./CommitmentClaims";

const dialog = storyCommitmentDialog();
const acceptClaim = fn(async (_claimant: string) => "0x123" as const);
const openDialog = fn();
const PENDING_CLAIMS = STORY_CLAIMS.map((row) => row.claim);
const FIRST = PENDING_CLAIMS[0]!.claimant;
/** Maria's ask, approved this visit: Ana's on the same ride closes. */
const APPROVED_HERE = {
  [claimRowKey(STORY_CLAIMS[0]!)]: {
    kind: "approved" as const,
    commitmentId: PENDING_CLAIMS[0]!.commitmentId.toString(),
    at: Number(STORY_NOW) * 1000,
  },
};
/** The line an Accept on the first request shows; every other row stays idle. */
const firstRow =
  (phase: TxActPhase) =>
  (claimant: string): TxActPhase =>
    claimant === FIRST ? phase : { status: "idle" };
const TEAM = dialog.detail?.contributors ?? [];
const ROSTER =
  TEAM.length > 0
    ? [
        TEAM[0],
        { ...TEAM[0], id: "c-2", contributor: STORY_JOAO, isLead: false, active: true },
        { ...TEAM[0], id: "c-3", contributor: STORY_ANA, isLead: false, active: false },
      ]
    : TEAM;

const meta: Meta<typeof CommitmentClaims> = {
  title: "Admin/Pool/CommitmentClaims",
  component: CommitmentClaims,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "Who asked to take a promise up (PRD-1025 D4), where a Waiting for approval row opens: each ask named the way the steward knows the person, when they asked and for whom, and, on a request, what they already hold in this pool and have kept. Approve stays one click and its progress takes the pair's place; Decline… asks for a reason and closes that ask only. Decided asks stay listed with their outcome. The same file carries the roster of who is on the record and the standing each of them holds.",
      },
    },
  },
  args: {
    claims: PENDING_CLAIMS,
    direction: "REQUEST",
    chainId: DEFAULT_CHAIN_ID,
    can: { ...dialog.can, acceptClaim: true },
    acts: { ...dialog.acts, acceptClaim },
    phaseFor: () => ({ status: "idle" }),
    decisions: {},
    standingOf: (claimant) =>
      claimant === FIRST ? { holding: 1, cap: 3, kept: 2 } : { holding: 0, cap: 3, kept: 0 },
    actDisabled: false,
    onOpenDialog: openDialog,
  },
  decorators: [
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentClaims>;

export const StewardCanAnswer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "Approve" })[0]!);
    const decline = canvas.getAllByRole("button", { name: /Decline/ })[0]!;
    decline.focus();
    await userEvent.keyboard("{Enter}");

    await expect(acceptClaim).toHaveBeenCalled();
    await expect(openDialog).toHaveBeenCalled();
  },
};

/** Approve is in the wallet: its progress takes the pair's place. */
export const Approving: Story = {
  args: { phaseFor: firstRow({ status: "signing", key: "accept" }) },
};

/** Approved this visit: the row keeps its outcome, and the other ask on the ride closes. */
export const Approved: Story = {
  args: {
    phaseFor: firstRow({ status: "confirmed", key: "accept", hash: null }),
    decisions: APPROVED_HERE,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Approved")).toBeInTheDocument();
    await expect(canvas.getByText("Not chosen")).toBeInTheDocument();
  },
};

/** Refused in the wallet: nothing changed, and the pair is back as Try Again. */
export const ApproveFailed: Story = {
  args: { phaseFor: firstRow({ status: "failed", key: "accept" }) },
};

/** On an offer the asker would receive, so what they hold as a provider isn't shown. */
export const OnAnOffer: Story = { args: { direction: "OFFER" } };

export const ReadOnly: Story = {
  args: { can: { ...dialog.can, acceptClaim: false } },
};

export const Offline: Story = {
  args: { can: { ...dialog.can, acceptClaim: true }, actDisabled: true },
};

export const Roster: Story = {
  render: () => <CommitmentRoster contributors={ROSTER} />,
};
