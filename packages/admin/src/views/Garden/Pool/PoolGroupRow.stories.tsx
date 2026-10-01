import { groupCommitmentsForDisplay } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { Meta, StoryObj } from "@storybook/react";
import type { PoolCommitmentGroup } from "./poolCommitmentRows";
import { STORY_GROUP_COPIES, STORY_GROUP_TITLES } from "./poolStoryFixtures";
import { PoolGroupRow } from "./PoolGroupRow";

const [GROUP] = groupCommitmentsForDisplay({
  commitments: STORY_GROUP_COPIES,
  metadataByCID: STORY_GROUP_TITLES,
}) as [PoolCommitmentGroup];

/** Nine created; the tenth didn't send and waits in the steward's queue. */
const [NINE] = groupCommitmentsForDisplay({
  commitments: STORY_GROUP_COPIES.slice(0, 9),
  metadataByCID: STORY_GROUP_TITLES,
}) as [PoolCommitmentGroup];

const meta: Meta<typeof PoolGroupRow> = {
  title: "Admin/Pool/PoolGroupRow",
  component: PoolGroupRow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Copies made together, as one row on the Promises card (PRD-1022 D3): the record row with a count chip, and a count line over every published copy: available, in progress, kept and, once any, ended. While a copy still waits in the steward's queue, the line says what was created and what didn't send, beside Finish Creating (n), in place of a separate queued row. The row opens the group's inspector.",
      },
    },
  },
  args: {
    group: GROUP,
    title: "Household water survey",
    unsent: 0,
    finishing: false,
    finishDisabled: false,
    onOpen: () => undefined,
    onFinish: () => undefined,
  },
  decorators: [
    (Story) => (
      <ul className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </ul>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolGroupRow>;

export const FiveDaysIn: Story = {};

export const OneDidNotSend: Story = { args: { group: NINE, unsent: 1 } };

export const Finishing: Story = { args: { group: NINE, unsent: 1, finishing: true } };
