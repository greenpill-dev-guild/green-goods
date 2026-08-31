import type { Meta, StoryObj } from "@storybook/react";
import { PoolCyclesCard } from "./PoolCyclesCard";
import { storyCycle, storyPool, storyPoolConsole } from "./poolStoryFixtures";

const noop = () => undefined;

const meta: Meta<typeof PoolCyclesCard> = {
  title: "Admin/Pool/PoolCyclesCard",
  component: PoolCyclesCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The cycles console: the one season as the card's header, the campaigns beside it as peers, the finished cycles below. One act on a cycle at a time, the next step in its life.",
      },
    },
  },
  args: {
    onStartSeason: noop,
    onOpenSeason: noop,
    onStartCampaign: noop,
    onOpenCampaign: noop,
    onCancelCycle: noop,
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolCyclesCard>;

export const OpenSeasonWithCampaigns: Story = { args: { console: storyPoolConsole() } };

export const SeededSeason: Story = {
  args: {
    console: storyPoolConsole({
      pool: storyPool({ state: "READY", openSeasonCycleId: null, openCampaignIds: [] }),
      cycles: [storyCycle({ state: "SEEDED", liveCommitmentCount: 0n })],
      commitments: [],
      claims: [],
    }),
  },
};

export const NoSeason: Story = {
  args: {
    console: storyPoolConsole({
      pool: storyPool({
        state: "READY",
        openSeasonCycleId: null,
        openCampaignIds: [],
        nonTerminalCycleCount: 0n,
      }),
      cycles: [],
      commitments: [],
      claims: [],
    }),
  },
};

export const Paused: Story = {
  args: { console: storyPoolConsole({ pool: storyPool({ state: "PAUSED" }) }) },
};
