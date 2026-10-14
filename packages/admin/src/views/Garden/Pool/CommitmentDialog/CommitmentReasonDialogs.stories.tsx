import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { STORY_MARIA, storyCommitmentDialog } from "../poolStoryFixtures";
import { PoolTarget } from "../PoolTarget";
import {
  CommitmentDeclineClaimDialog,
  CommitmentFallbackDialog,
  CommitmentReasonDialogs,
} from "./CommitmentReasonDialogs";

const dialog = storyCommitmentDialog();
const RECORD = "Ride to the market on Saturday";
const REASONED = {
  onClose: () => undefined,
  tone: "garden" as const,
  acts: dialog.acts,
  blockedReason: undefined,
  // Every dialog names the commitment and its garden's pool under its title.
  target: (
    <PoolTarget
      target={{ gardenName: STORYBOOK_PRIMARY_ADMIN_GARDEN.name, isProtocol: false }}
      record={RECORD}
    />
  ),
};

const meta: Meta<typeof CommitmentReasonDialogs> = {
  title: "Admin/Pool/CommitmentReasonDialogs",
  component: CommitmentReasonDialogs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The reasoned acts on a live commitment: call it off, mark it ready over the recipient's send, freeze it for review, confirm it when nobody on the ordinary path can, or decline one request to take it up. None of them can be sent blank, and the member reads the reason rather than the bare state.",
      },
    },
  },
  args: { ...REASONED, open: "cancel" },
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentReasonDialogs>;

export const Cancel: Story = {};

export const MarkReady: Story = {
  args: { open: "mark-ready" },
};

export const RaiseDispute: Story = {
  args: { open: "raise-dispute" },
};

export const GardenFallbackConfirm: Story = {
  render: () => (
    <CommitmentFallbackDialog {...REASONED} open="fallback-confirm" fallbackPath="POOL_FALLBACK" />
  ),
};

/** Names who asked, and for which commitment, from the seeded gardens list. */
export const DeclineRequest: Story = {
  decorators: [withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS)],
  render: () => (
    <CommitmentDeclineClaimDialog
      {...REASONED}
      chainId={DEFAULT_CHAIN_ID}
      garden={STORYBOOK_PRIMARY_ADMIN_GARDEN.id as Address}
      record={RECORD}
      open={{ kind: "decline-claim", claimant: STORY_MARIA }}
    />
  ),
};
