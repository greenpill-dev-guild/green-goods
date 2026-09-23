import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import {
  type PoolCommitmentFocus,
  type PoolCommitmentScope,
  PoolCommitmentsCard,
} from "./PoolCommitmentsCard";
import { STORY_COMMITMENTS, storyCommitment } from "./poolStoryCommitments";
import { storyPoolConsole } from "./poolStoryFixtures";

/** The card owns no filter state; the story does, so the chips work. */
function PoolCommitmentsCardWithScope(props: ComponentProps<typeof PoolCommitmentsCard>) {
  const [scope, setScope] = useState<PoolCommitmentScope>(props.scope);
  const [focus, setFocus] = useState<PoolCommitmentFocus>(props.focus);
  return (
    <div className="max-w-2xl p-4" data-tone="garden">
      <PoolCommitmentsCard
        {...props}
        scope={scope}
        onScopeChange={setScope}
        focus={focus}
        onFocusChange={setFocus}
      />
    </div>
  );
}

const meta: Meta<typeof PoolCommitmentsCard> = {
  title: "Admin/Pool/PoolCommitmentsCard",
  component: PoolCommitmentsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One commitments card for the whole pool: search, the Open · Confirmed · Past chips, a Past due chip for live rows the chain would let anyone expire, a Needs recovery chip for those and the disputed ones, and rows that open in the left inspector. Expire now… is outlined where it sits; the red is for the confirm inside its dialog.",
      },
    },
  },
  args: {
    onOpenCommitment: () => undefined,
    onSeed: () => undefined,
    canSeed: true,
    scope: "open",
    focus: null,
  },
  render: (args) => <PoolCommitmentsCardWithScope {...args} />,
};

export default meta;
type Story = StoryObj<typeof PoolCommitmentsCard>;

export const Open: Story = {
  args: { console: storyPoolConsole() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Prune the north beds")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Confirmed" }));
    await expect(await canvas.findByText("Repair the greenhouse")).toBeVisible();
  },
};

export const PastDue: Story = {
  args: { console: storyPoolConsole(), focus: "pastDue" },
};

/** Reached from Needs recovery on the stats card: the dispute and the past-due row, nothing else. */
export const NeedsRecovery: Story = {
  args: {
    console: storyPoolConsole({
      commitments: [
        ...STORY_COMMITMENTS,
        storyCommitment({
          id: "42161-7",
          commitmentId: 7n,
          onchainState: "DISPUTED",
          derivedState: "DISPUTED",
          state: "DISPUTED",
          metadataCID: "bafy-6",
        }),
      ],
    }),
    focus: "recovery",
  },
};

export const Queued: Story = {
  args: {
    console: storyPoolConsole({
      pendingCreates: [
        {
          jobId: "job-1",
          chainId: 42161,
          poolId: "7",
          direction: "OFFER",
          title: "Compost workshop",
          unitLabel: "workshop",
          targetUnits: "1",
          waitingForMembership: false,
          discardable: true,
          failed: false,
          createdAt: daysAgo(0) * 1000,
        },
      ],
    }),
  },
};

/** The two queued rows that are not plain "Queued": send failure and the membership wait. */
export const QueuedNeedsAttention: Story = {
  args: {
    console: storyPoolConsole({
      pendingCreates: [
        {
          jobId: "job-2",
          chainId: 42161,
          poolId: "7",
          direction: "OFFER",
          title: "Repair the tool library",
          unitLabel: "repair",
          targetUnits: "1",
          waitingForMembership: false,
          discardable: true,
          failed: true,
          createdAt: daysAgo(0) * 1000,
        },
        {
          jobId: "job-3",
          chainId: 42161,
          poolId: "7",
          direction: "REQUEST",
          title: "Seed swap afternoon",
          unitLabel: "session",
          targetUnits: "2",
          waitingForMembership: true,
          discardable: true,
          failed: false,
          createdAt: daysAgo(0) * 1000,
        },
      ],
    }),
  },
};

export const Empty: Story = {
  args: { console: storyPoolConsole({ commitments: [], claims: [] }) },
};
