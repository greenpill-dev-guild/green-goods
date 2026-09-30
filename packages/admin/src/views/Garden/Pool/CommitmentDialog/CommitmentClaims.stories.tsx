import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { STORY_ANA, STORY_CLAIMS, STORY_JOAO, storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentClaims, CommitmentRoster } from "./CommitmentClaims";

const dialog = storyCommitmentDialog();
const acceptClaim = fn(async (_claimant: string) => "0x123" as const);
const openDialog = fn();
const PENDING_CLAIMS = STORY_CLAIMS.map((row) => row.claim);
const FIRST = PENDING_CLAIMS[0]!.claimant;
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
          "Who has asked to take a commitment up, named the way the steward knows them, and the steward's answer. Accept stays one click and its row then says where it stands, held closed until the index moves the request on. Declining closes one request only: the rest stay pending and the commitment stays claimable. The same file carries the roster of who is on the record and the standing each of them holds.",
      },
    },
  },
  args: {
    claims: PENDING_CLAIMS,
    chainId: DEFAULT_CHAIN_ID,
    can: { ...dialog.can, acceptClaim: true },
    acts: { ...dialog.acts, acceptClaim },
    phaseFor: () => ({ status: "idle" }),
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
    await userEvent.click(canvas.getAllByRole("button", { name: "Accept" })[0]!);
    const decline = canvas.getAllByRole("button", { name: /Decline/ })[0]!;
    decline.focus();
    await userEvent.keyboard("{Enter}");

    await expect(acceptClaim).toHaveBeenCalled();
    await expect(openDialog).toHaveBeenCalled();
  },
};

/** Accept is in the wallet: the row says so and holds both acts closed. */
export const Accepting: Story = {
  args: { phaseFor: firstRow({ status: "signing", key: "accept" }) },
};

/** The receipt landed but the index has not moved the request on yet. */
export const AcceptedAwaitingIndex: Story = {
  args: { phaseFor: firstRow({ status: "confirmed", key: "accept", hash: null }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Accepted. The request leaves this list once the index shows it.")
    ).toBeInTheDocument();
    await expect(canvas.getAllByRole("button", { name: "Accept" })[0]).toBeDisabled();
  },
};

/** Refused in the wallet: nothing changed, and Accept is open again. */
export const AcceptFailed: Story = {
  args: { phaseFor: firstRow({ status: "failed", key: "accept" }) },
};

export const ReadOnly: Story = {
  args: { can: { ...dialog.can, acceptClaim: false } },
};

export const Offline: Story = {
  args: { can: { ...dialog.can, acceptClaim: true }, actDisabled: true },
};

export const Roster: Story = {
  render: () => <CommitmentRoster contributors={ROSTER} />,
};
