import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { buildCommitmentMetadata } from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { STORYBOOK_NOW_SECONDS } from "../../../../../../shared/.storybook/fixtures";
import { STORY_GARDEN, STORY_STEWARD } from "../poolStoryActors";
import { AddToGroupDialog } from "./AddToGroupDialog";

const meta: Meta<typeof AddToGroupDialog> = {
  title: "Admin/Pool/AddToGroupDialog",
  component: AddToGroupDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Add to This Group (PRD-1022 D4, screens 28–30): one dialog, not the four-step flow, because only the number is asked. The new promises take the group's terms, deadline and G$ amount, shown read-only under Same as the group, so they join its row. One summary at the top compares the group before and after, and its first lines carry ready, approving and declined while the comparison stays put. It sends like Seed Promises: once per ten on a wallet that can bundle, once per promise otherwise.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    onBack: () => undefined,
    onAdded: () => undefined,
    chainId: DEFAULT_CHAIN_ID,
    garden: STORY_GARDEN,
    isProtocol: false,
    owner: STORY_STEWARD,
    title: "Household water survey",
    group: {
      displayGroupId: "5f0c2b1e-8a4d-4c2e-9f3a-1b2c3d4e5f60",
      dueDate: BigInt(STORYBOOK_NOW_SECONDS + 12 * 86_400),
      templateCommitmentId: 21n,
      metadata: buildCommitmentMetadata({
        title: "Household water survey",
        displayGroup: { version: 1, id: "5f0c2b1e-8a4d-4c2e-9f3a-1b2c3d4e5f60" },
      }),
      gardenAddress: STORY_GARDEN,
    },
    counts: { published: 10, available: 4, inProgress: 3, kept: 2, ended: 1 },
    terms: [
      ["Each asks for", "1 survey · The pool requests"],
      ["Due", "Wed, Jan 28, 2026, 12:00 AM UTC"],
      ["Reward", "$5.00 each in G$ (38,866 G$, the group's amount)"],
      ["Claim mode · confirmers", "Open · Lina Park and 2 others"],
    ],
    rewardCents: 500n,
  },
  decorators: [withAdminIdentity, withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS)],
};

export default meta;
type Story = StoryObj<typeof AddToGroupDialog>;

export const Ready: Story = {};

/** A group without a reward: the comparison leaves the reward row out. */
export const NoReward: Story = {
  args: {
    rewardCents: null,
    terms: [
      ["Each asks for", "4 rides · The pool offers"],
      ["Due", "Wed, Jan 28, 2026, 12:00 AM UTC"],
      ["Reward", "None"],
      ["Claim mode · confirmers", "Steward-reviewed · whoever takes one up"],
    ],
    counts: { published: 6, available: 6, inProgress: 0, kept: 0, ended: 0 },
  },
};
