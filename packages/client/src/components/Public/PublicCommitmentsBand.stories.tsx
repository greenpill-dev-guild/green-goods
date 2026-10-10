import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { PublicCommitmentImpactRecord } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { withRouter, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { PublicCommitmentsBand } from "./PublicCommitmentsBand";

const CHAIN_ID = 42161;

function impact(
  overrides: Partial<PublicCommitmentImpactRecord> = {}
): PublicCommitmentImpactRecord {
  const unavailableSources = overrides.unavailableSources ?? {
    commitmentPools: false,
    confirmedSettlement: false,
    fundingValuation: false,
  };
  return {
    commitmentsMade: 61n,
    commitmentsFulfilled: 43n,
    confirmedDisbursementTotal: 3120000n * 10n ** 18n,
    confirmedDisbursementUsdCents: 31200n,
    partialData: Object.values(unavailableSources).some(Boolean),
    unavailableSources,
    ...overrides,
  };
}

function seeded(record: PublicCommitmentImpactRecord) {
  return withSeededQueryClient([[queryKeys.public.commitmentImpact(CHAIN_ID), record]]);
}

const meta: Meta<typeof PublicCommitmentsBand> = {
  title: "Client/Public/PublicCommitmentsBand",
  component: PublicCommitmentsBand,
  args: { chainId: CHAIN_ID },
  decorators: [withRouter(["/impact"])],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Community commitments on the public Impact page: offers and requests made, " +
          "commitments kept, and funding received in US dollars using historical receipt-time prices. " +
          "Unavailable figures are labelled and never replaced with zero.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PublicCommitmentsBand>;

export const Live: Story = { decorators: [seeded(impact())] };
export const NothingYet: Story = {
  decorators: [
    seeded(
      impact({
        commitmentsMade: 0n,
        commitmentsFulfilled: 0n,
        confirmedDisbursementTotal: 0n,
        confirmedDisbursementUsdCents: 0n,
      })
    ),
  ],
};
export const PartialRead: Story = {
  decorators: [
    seeded(
      impact({
        confirmedDisbursementTotal: null,
        confirmedDisbursementUsdCents: null,
        unavailableSources: {
          commitmentPools: false,
          confirmedSettlement: true,
          fundingValuation: true,
        },
      })
    ),
  ],
};
export const HistoricalPriceUnavailable: Story = {
  decorators: [
    seeded(
      impact({
        confirmedDisbursementUsdCents: null,
        unavailableSources: {
          commitmentPools: false,
          confirmedSettlement: false,
          fundingValuation: true,
        },
      })
    ),
  ],
};
export const Unavailable: Story = {
  decorators: [
    seeded(
      impact({
        commitmentsMade: null,
        commitmentsFulfilled: null,
        confirmedDisbursementTotal: null,
        confirmedDisbursementUsdCents: null,
        unavailableSources: {
          commitmentPools: true,
          confirmedSettlement: true,
          fundingValuation: true,
        },
      })
    ),
  ],
};
