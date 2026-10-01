import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { STORY_GARDEN, STORY_PRICE_SEED } from "../poolStoryFixtures";
import { EditRewardDialog } from "./EditRewardDialog";

const meta: Meta<typeof EditRewardDialog> = {
  title: "Admin/Pool/EditRewardDialog",
  component: EditRewardDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Edit Reward (PRD-1022 D14, screens 31–33), from a group's inspector until one copy is kept, or a single promise's while nobody has taken it. One summary at the top says what changes: the new reward for every copy nobody has taken, while the people who took theirs keep what they agreed to. The steward types dollars; the G$ amount is converted at the price read just before the change and fixed from then, and the wallet is asked once for the group where it can be.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    onChanged: () => undefined,
    chainId: DEFAULT_CHAIN_ID,
    garden: STORY_GARDEN,
    isProtocol: false,
    title: "Compost bin check-ins",
    available: [3n, 4n, 5n, 6n],
    takenBy: ["Joon Park", "Sofia Mendes"],
    currentWei: 23_319_457_863_579_084_743_441n,
    currentCentsAsSet: 300n,
    settlementActive: true,
  },
  decorators: [
    withAdminIdentity,
    // At the story price, $3.00 is about 23,319 G$.
    withSeededQueryClient([...STORYBOOK_ADMIN_SHELL_SEEDS, STORY_PRICE_SEED]),
  ],
};

export default meta;
type Story = StoryObj<typeof EditRewardDialog>;

/** Four available at $3.00, two taken: the two keep theirs. */
export const TwoTaken: Story = {};

export const NoneTakenYet: Story = { args: { takenBy: [], available: [3n, 4n, 5n, 6n, 7n, 8n] } };

/** Set before rewards were recorded in dollars: today's rate, marked as an estimate. */
export const OlderReward: Story = { args: { currentCentsAsSet: null } };

/** One promise on its own, in its own inspector. */
export const SinglePromise: Story = {
  args: { title: "Clinic rides on Thursdays", available: [11n], takenBy: [] },
};

export const SettlementNotActive: Story = { args: { settlementActive: false } };
