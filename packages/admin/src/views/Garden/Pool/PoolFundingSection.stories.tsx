import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { AdminCard } from "@/components/AdminCard";
import { PoolFundingSection } from "./PoolFundingSection";
import { STORY_PRICE_SEED, STORY_PRICE_STATE } from "./poolStoryFixtures";
import { storyPoolFunding } from "./poolStoryControllers";

const G = 10n ** 18n;
const base = storyPoolFunding().snapshot!;

/**
 * The design's pool at the story price: about $2,000 in the Safe, $760
 * committed and $1,240 free for new promises.
 */
const funded = {
  ...base,
  balance: { ...base.balance!, value: 15_546_400n * G },
  committed: 5_907_600n * G,
  expected: 0n,
  authorizedFeeBuffer: 0n,
  expectedFeeBuffer: 700n * G,
  feeBuffer: 700n * G,
  available: 9_638_100n * G,
};

const meta: Meta<typeof PoolFundingSection> = {
  title: "Admin/Pool/PoolFundingSection",
  component: PoolFundingSection,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Pool Funding, its own compact card at the foot of the Pool tab's right column (PRD-1025 D9), shared by Garden and Protocol pools. What is available for new promises comes first, in dollars at today's G$ price with the G$ amount beside; then one line for the Safe and what is committed, the funding and settlement chips, and the read time with View Details. The Safe's address and explorer link are in the details dialog. Without a price the amounts read in G$.",
      },
    },
  },
  args: {
    funding: storyPoolFunding({ snapshot: funded }),
    onOpenDetails: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm p-4" data-tone="garden">
        <AdminCard variant="elevated">
          <Story />
        </AdminCard>
      </div>
    ),
    withSeededQueryClient([STORY_PRICE_SEED]),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolFundingSection>;

export const Healthy: Story = {
  play: async () => {
    await expect(screen.getByText("$1,240")).toBeInTheDocument();
    await expect(screen.getByText("$2,000 in the Safe · $760 committed")).toBeInTheDocument();
  },
};

/** A read older than five minutes converts nothing: the card reads in G$ alone. */
export const NoPrice: Story = {
  decorators: [
    withSeededQueryClient([
      [
        queryKeys.tokens.goodDollarPrice(),
        { price: STORY_PRICE_STATE.price, readAt: STORY_PRICE_STATE.readAt - 10 * 60_000 },
      ],
    ]),
  ],
};

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
    funding: storyPoolFunding({ snapshot: funded, isError: true, hasStaleBalance: true }),
  },
  play: async () => {
    await expect(
      screen.getByText("The latest funding read failed. Refresh to check current availability.")
    ).toBeInTheDocument();
  },
};

/** Nothing is left for new promises: the chip turns to Low balance. */
export const Low: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: {
        ...funded,
        available: 0n,
        suggestedTopUp: 2_000_000n * G,
        fundingState: "low",
      },
    }),
  },
};

/** Funding cannot be calculated: the card names why, not only that. */
export const FundingUnavailable: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: {
        ...funded,
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

/** No Safe is registered for this pool yet. */
export const NoSafe: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: {
        ...funded,
        safe: null,
        routeAddresses: { account: null, indexed: null, live: null },
        balance: null,
        committed: null,
        available: null,
        fundingState: "unavailable",
        fundingUnavailableReasons: ["missing_account", "balance_unreadable"],
        settlementReadiness: "unavailable",
        settlementUnavailableReasons: ["missing_account", "balance_unreadable"],
      },
    }),
  },
};

/** Funding is healthy but settlement cannot run yet: the card names the one thing in the way. */
export const SettlementBlocked: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: {
        ...funded,
        settlementReadiness: "unavailable",
        settlementUnavailableReasons: ["executor_paused"],
      },
    }),
  },
};
