import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { PoolClaimsCard } from "./PoolClaimsCard";
import { STORY_CLAIMS, storyPool, storyPoolConsole } from "./poolStoryFixtures";

const FIRST = STORY_CLAIMS[0]!.claim;

const meta: Meta<typeof PoolClaimsCard> = {
  title: "Admin/Pool/PoolClaimsCard",
  component: PoolClaimsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The claims queue, rendered only while steward-reviewed requests wait. Each row names the stored claimant the way the steward knows them, the claim type and when; accept and decline are paired opposites keyed to that claimant. Accept stays one click, and its row then says where it stands until the index moves the request on.",
      },
    },
  },
  args: { onDecline: () => undefined },
  decorators: [
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolClaimsCard>;

export const Waiting: Story = { args: { console: storyPoolConsole() } };

/** Accept went out from the first row and the chain is confirming it. */
export const Accepting: Story = {
  args: {
    console: storyPoolConsole({
      claimPhase: (commitmentId, claimant) =>
        commitmentId === FIRST.commitmentId && claimant === FIRST.claimant
          ? { status: "confirming", key: "accept", hash: `0x${"a".repeat(64)}` }
          : { status: "idle" },
    }),
  },
};

export const Paused: Story = {
  args: { console: storyPoolConsole({ pool: storyPool({ state: "PAUSED" }) }) },
};
