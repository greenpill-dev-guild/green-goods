import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { STORY_ANA, STORY_CLAIMS, STORY_JOAO, storyCommitmentDialog } from "../poolStoryFixtures";
import { CommitmentClaims, CommitmentRoster } from "./CommitmentClaims";

const dialog = storyCommitmentDialog();
const acceptClaim = fn(async (_claimant: string) => "0x123" as const);
const openDialog = fn();
const PENDING_CLAIMS = STORY_CLAIMS.map((row) => row.claim);
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
          "Who has asked to take a commitment up, and the steward's answer. Declining closes one request only: the rest stay pending and the commitment stays claimable. The same file carries the roster of who is on the record and the standing each of them holds.",
      },
    },
  },
  args: {
    claims: PENDING_CLAIMS,
    can: { ...dialog.can, acceptClaim: true },
    acts: { ...dialog.acts, acceptClaim },
    actDisabled: false,
    onOpenDialog: openDialog,
  },
  decorators: [
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

export const ReadOnly: Story = {
  args: { can: { ...dialog.can, acceptClaim: false } },
};

export const Offline: Story = {
  args: { can: { ...dialog.can, acceptClaim: true }, actDisabled: true },
};

export const Roster: Story = {
  render: () => <CommitmentRoster contributors={ROSTER} />,
};
