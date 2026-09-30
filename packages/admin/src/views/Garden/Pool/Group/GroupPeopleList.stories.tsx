import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import {
  STORY_GROUP_COPIES,
  STORY_GROUP_EVENTS,
  STORY_GROUP_WAITING_ON_YOU,
} from "../poolStoryFixtures";
import { GroupPeopleList } from "./GroupPeopleList";
import { groupInspectorRows } from "./groupInspectorModel";

const ROWS = groupInspectorRows(STORY_GROUP_COPIES, STORY_GROUP_EVENTS);

const meta: Meta<typeof GroupPeopleList> = {
  title: "Admin/Pool/GroupPeopleList",
  component: GroupPeopleList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The group inspector's list (PRD-1022 screen 14): each row leads with the person who took the copy, with when they took it, where the proof stands, who confirmed it and whether the reward was paid, and its state on the right; a person's second copy says so. The copies nobody has taken share one row. No copy numbers; every row opens that promise's own inspector.",
      },
    },
  },
  args: {
    taken: ROWS.taken,
    available: ROWS.available,
    showAvailable: true,
    chainId: DEFAULT_CHAIN_ID,
    rewarded: true,
    waitingOnYou: STORY_GROUP_WAITING_ON_YOU,
    onOpenCommitment: () => undefined,
  },
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
type Story = StoryObj<typeof GroupPeopleList>;

export const EveryCopy: Story = {};

/** Without a reward the rows don't mention one. */
export const NoReward: Story = { args: { rewarded: false } };

/** The Kept filter: the not-taken row gives way. */
export const KeptOnly: Story = {
  args: { taken: ROWS.taken.filter((row) => row.bucket === "kept"), showAvailable: false },
};
