import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { PoolCommitmentsCard, type PoolCommitmentScope } from "./PoolCommitmentsCard";
import { storyPoolConsole } from "./poolStoryFixtures";

const meta: Meta<typeof PoolCommitmentsCard> = {
  title: "Admin/Pool/PoolCommitmentsCard",
  component: PoolCommitmentsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One commitments card for the whole pool: search, the Open · Confirmed · Past chips, a Past due chip for live rows the chain would let anyone expire, and rows that open in the left inspector.",
      },
    },
  },
  args: {
    onOpenCommitment: () => undefined,
    onSeed: () => undefined,
    canSeed: true,
    scope: "open",
    dueOnly: false,
  },
  render: (args) => {
    const [scope, setScope] = useState<PoolCommitmentScope>(args.scope);
    const [dueOnly, setDueOnly] = useState(args.dueOnly);
    return (
      <div className="max-w-2xl p-4" data-tone="garden">
        <PoolCommitmentsCard
          {...args}
          scope={scope}
          onScopeChange={setScope}
          dueOnly={dueOnly}
          onDueOnlyChange={setDueOnly}
        />
      </div>
    );
  },
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
  args: { console: storyPoolConsole(), dueOnly: true },
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
