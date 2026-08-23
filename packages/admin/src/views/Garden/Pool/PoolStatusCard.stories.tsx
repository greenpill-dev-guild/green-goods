import type { Meta, StoryObj } from "@storybook/react";
import { PoolStatusCard } from "./PoolStatusCard";
import { storyNotReadyPool, storyPool, storyPoolConsole } from "./poolStoryFixtures";

const noop = () => undefined;

const meta: Meta<typeof PoolStatusCard> = {
  title: "Admin/Pool/PoolStatusCard",
  component: PoolStatusCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The pool is the container; this card is its one home in the pool tab's rail: status, the setup checklist while a garden is being set up, the commitment limit and charter once it runs, the pause reason, and the lifecycle acts.",
      },
    },
  },
  args: {
    onEditSettings: noop,
    onPause: noop,
    onClosePool: noop,
    onCompostPool: noop,
    onReopenPool: noop,
    onReviewLive: noop,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolStatusCard>;

export const NotReady: Story = {
  args: {
    console: storyPoolConsole({
      pool: storyNotReadyPool(),
      charter: { charter: null, isLoading: false, isUnavailable: false },
    }),
  },
};

export const Open: Story = { args: { console: storyPoolConsole() } };

export const Paused: Story = {
  args: {
    console: storyPoolConsole({
      pool: storyPool({ state: "PAUSED", pauseReasonCID: "bafy-reason" }),
      pauseReason: {
        reason: { version: 1, reason: "Seasonal flooding, back after the rains" },
        isLoading: false,
        isUnavailable: false,
      },
    }),
  },
};

export const ReadyToClose: Story = {
  args: {
    console: storyPoolConsole({
      pool: storyPool({
        liveCommitmentCount: 0n,
        nonTerminalCycleCount: 0n,
        openSeasonCycleId: null,
        openCampaignIds: [],
      }),
      cycles: [],
      commitments: [],
      claims: [],
    }),
  },
};

export const Closed: Story = {
  args: { console: storyPoolConsole({ pool: storyPool({ state: "CLOSED" }) }) },
};

export const Archived: Story = {
  args: { console: storyPoolConsole({ pool: storyPool({ state: "COMPOSTED" }) }) },
};

export const Offline: Story = {
  args: { console: storyPoolConsole({ isOnline: false }) },
};
