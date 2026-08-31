import type { Meta, StoryObj } from "@storybook/react";
import { PoolReasonDialogs } from "./PoolReasonDialogs";
import { STORY_CLAIMS, STORY_CYCLES, storyPoolConsole } from "./poolStoryFixtures";

const meta: Meta<typeof PoolReasonDialogs> = {
  title: "Admin/Pool/PoolReasonDialogs",
  component: PoolReasonDialogs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The pool console's three reasoned acts. Pausing names how many open commitments stop; cancelling a cycle and declining a claim each say what the member sees. Every one pins its reason before the call, so none of them can be sent blank.",
      },
    },
  },
  args: {
    pool: storyPoolConsole(),
    tone: "garden" as const,
    setReasonDialog: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolReasonDialogs>;

export const PausePool: Story = {
  args: { reasonDialog: { kind: "pause" } },
};

export const CancelCycle: Story = {
  args: { reasonDialog: { kind: "cancel-cycle", cycle: STORY_CYCLES[0]! } },
};

export const DeclineClaim: Story = {
  args: { reasonDialog: { kind: "decline-claim", row: STORY_CLAIMS[0]! } },
};

export const Closed: Story = {
  args: { reasonDialog: null },
};
