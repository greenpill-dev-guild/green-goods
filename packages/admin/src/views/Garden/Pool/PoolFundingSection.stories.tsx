import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";
import { PoolFundingSection } from "./PoolFundingSection";
import { storyPoolFunding } from "./poolStoryControllers";

const meta: Meta<typeof PoolFundingSection> = {
  title: "Admin/Pool/PoolFundingSection",
  component: PoolFundingSection,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The compact read-only funding summary shared by Garden and Protocol pools. Live balance, obligations, derived availability, route readiness, and freshness stay visually distinct from settlement actions.",
      },
    },
  },
  args: {
    funding: storyPoolFunding(),
    onOpenDetails: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-[var(--m3-shape-lg)] bg-bg-white-0 p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolFundingSection>;

export const Healthy: Story = {};

export const ProtocolPool: Story = {
  args: { protocolContext: true },
};

export const Loading: Story = {
  args: {
    funding: storyPoolFunding({ snapshot: null, isLoading: true, isFetching: true }),
  },
};

export const LastKnownBalance: Story = {
  args: {
    funding: storyPoolFunding({ isError: true, hasStaleBalance: true }),
  },
  play: async () => {
    await expect(
      screen.getByText("The latest funding read failed. Refresh to check current availability.")
    ).toBeInTheDocument();
  },
};

const ready = storyPoolFunding().snapshot;

/** Funding cannot be calculated: the rail names why, not only that. */
export const FundingUnavailable: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: ready && {
        ...ready,
        committed: null,
        expected: null,
        available: null,
        shortfall: null,
        suggestedTopUp: null,
        fundingState: "unavailable",
        fundingUnavailableReasons: ["ledger_unavailable"],
        settlementReadiness: "unavailable",
        settlementUnavailableReasons: ["ledger_unavailable"],
      },
    }),
  },
};

/** Funding is healthy but settlement cannot run yet: the rail names the one thing in the way. */
export const SettlementBlocked: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: ready && {
        ...ready,
        settlementReadiness: "unavailable",
        settlementUnavailableReasons: ["executor_paused"],
      },
    }),
  },
};
