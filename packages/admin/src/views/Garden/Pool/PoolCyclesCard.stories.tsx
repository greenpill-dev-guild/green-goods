import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
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
          "The cycles console: the one season as the card's header, the campaigns beside it as peers, the finished cycles below. Each cycle offers the next step in its life: End once nothing in it is live (and until then, how many commitments hold it open), Archive once it is reconciled, Cancel while it is empty.",
      },
    },
  },
  args: {
    onStartSeason: noop,
    onOpenSeason: noop,
    onStartCampaign: noop,
    onOpenCampaign: noop,
    onCancelCycle: noop,
    onEndCycle: noop,
    onArchiveCycle: noop,
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

/** Live commitments hold the season and the campaign open, and each says how many. */
export const OpenSeasonWithCampaigns: Story = {
  args: { console: storyPoolConsole() },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/3 commitments are still live\./)
    ).toBeInTheDocument();
  },
};

/** Everything in the season and the campaign has finished: both can end. */
export const ReadyToEnd: Story = {
  args: {
    console: storyPoolConsole({
      cycles: [
        storyCycle({ liveCommitmentCount: 0n }),
        storyCycle({
          id: `${DEFAULT_CHAIN_ID}-13`,
          cycleId: 13n,
          cycleType: "CAMPAIGN",
          metadataCID: "bafy-campaign",
          liveCommitmentCount: 0n,
        }),
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "End Season…" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "End…" })).toBeInTheDocument();
  },
};

/** The season ended and is reconciled: a new one can start, and it can be archived. */
export const ReconciledSeason: Story = {
  args: {
    console: storyPoolConsole({
      pool: storyPool({ openSeasonCycleId: null, openCampaignIds: [] }),
      cycles: [
        storyCycle({ state: "RECONCILED", liveCommitmentCount: 0n }),
        storyCycle({
          id: `${DEFAULT_CHAIN_ID}-11`,
          cycleId: 11n,
          state: "COMPOSTED",
          metadataCID: "bafy-last-season",
          liveCommitmentCount: 0n,
        }),
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      within(canvas.getByTestId("pool-cycle-12")).getByRole("button", { name: "Archive…" })
    ).toBeInTheDocument();
    await expect(
      within(canvas.getByTestId("pool-cycle-11")).queryByRole("button")
    ).not.toBeInTheDocument();
  },
};

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
