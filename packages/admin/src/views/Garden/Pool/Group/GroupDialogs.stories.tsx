import { groupCommitmentsForDisplay } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import type { PoolCommitmentGroup } from "../poolCommitmentRows";
import {
  STORY_COMMITMENTS,
  STORY_GROUP_COPIES,
  STORY_GROUP_TITLES,
  STORY_PRICE_SEED,
  STORY_TITLES,
  storyPoolConsole,
} from "../poolStoryFixtures";
import { GroupDialogs } from "./GroupDialogs";

const TITLES = new Map([...STORY_TITLES, ...STORY_GROUP_TITLES]);
const [GROUP] = groupCommitmentsForDisplay({
  commitments: STORY_GROUP_COPIES,
  metadataByCID: STORY_GROUP_TITLES,
}) as [PoolCommitmentGroup];

const meta: Meta<typeof GroupDialogs> = {
  title: "Admin/Pool/GroupDialogs",
  component: GroupDialogs,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The group inspector and where it leads (PRD-1022 D4, D14): Seed More Like This, which adds to the group or starts a new one in the Seed flow, and Edit Reward while no copy is kept. Each dialog closes back to the inspector, which says what changed. The pool's activity supplies the dates on each row.",
      },
    },
  },
  args: {
    pool: storyPoolConsole({
      commitments: [...STORY_COMMITMENTS, ...STORY_GROUP_COPIES],
      titles: TITLES,
    }),
    group: GROUP,
    title: "Household water survey",
    isProtocol: false,
    onClose: () => undefined,
    onOpenCommitment: () => undefined,
    onSeedNew: () => undefined,
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient([...STORYBOOK_ADMIN_SHELL_SEEDS, STORY_PRICE_SEED]),
  ],
};

export default meta;
type Story = StoryObj<typeof GroupDialogs>;

export const Inspecting: Story = {};
