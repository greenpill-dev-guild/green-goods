import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { type PublicCommitmentImpactRecord } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { withRouter, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { PublicCommitmentsBand } from "./PublicCommitmentsBand";

const CHAIN_ID = 42161;

/**
 * The band reads one aggregate record through `usePublicCommitmentImpact`.
 * Seeding its query key is the whole fixture: no network, no mock hook, the
 * real component against the real selector and formatters.
 */
function impact(
  overrides: Partial<PublicCommitmentImpactRecord> = {}
): PublicCommitmentImpactRecord {
  const unavailableSources = overrides.unavailableSources ?? {
    commitmentPools: false,
    distinctProviders: false,
    confirmedSettlement: false,
  };
  return {
    openPoolCount: 11n,
    commitmentsFulfilled: 43n,
    commitmentsDue: 50n,
    distinctProviderCount: 9n,
    confirmedDisbursementTotal: 312n * 10n ** 18n,
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
          "`/impact` § 02 — protocol-wide commitment aggregates: a canvas header, then one " +
          "editorial panel holding four markers in the § 01 proof-marker grammar. Gardens with " +
          "open pools, lifetime commitments fulfilled, the share of taken-up commitments kept " +
          "(published only above the ≥ 5 due / ≥ 3 providers threshold), and CCIP-confirmed " +
          "G$ support, with the lifecycle sentence and the way into the Gardens as the panel's " +
          "footer line. A failed source renders an em dash, never a zero; " +
          '"support arrived" names the confirmed total and nothing else.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicCommitmentsBand>;

/** Above threshold: the one sanctioned percentage is fulfilled / due. */
export const Live: Story = {
  decorators: [seeded(impact())],
};

/** 3 of 4 due: counts only, no percentage anywhere on the band. */
export const CountsOnly: Story = {
  decorators: [
    seeded(impact({ commitmentsFulfilled: 3n, commitmentsDue: 4n, distinctProviderCount: 9n })),
  ],
};

/** Enough commitments, too few distinct providers: still counts only. */
export const CountsOnlyFewProviders: Story = {
  decorators: [
    seeded(impact({ commitmentsFulfilled: 40n, commitmentsDue: 50n, distinctProviderCount: 2n })),
  ],
};

/** Before any pool opens: readiness phrasing, never a live `0`. */
export const NothingYet: Story = {
  decorators: [
    seeded(
      impact({
        openPoolCount: 0n,
        commitmentsFulfilled: 0n,
        commitmentsDue: 0n,
        distinctProviderCount: 0n,
        confirmedDisbursementTotal: 0n,
      })
    ),
  ],
};

/** Only the settlement read failed: its marker dashes, the rest stay. */
export const PartialRead: Story = {
  decorators: [
    seeded(
      impact({
        confirmedDisbursementTotal: null,
        unavailableSources: {
          commitmentPools: false,
          distinctProviders: false,
          confirmedSettlement: true,
        },
      })
    ),
  ],
};

/** Every source failed: four em dashes and the partial notice. */
export const Unavailable: Story = {
  decorators: [
    seeded(
      impact({
        openPoolCount: null,
        commitmentsFulfilled: null,
        commitmentsDue: null,
        distinctProviderCount: null,
        confirmedDisbursementTotal: null,
        unavailableSources: {
          commitmentPools: true,
          distinctProviders: true,
          confirmedSettlement: true,
        },
      })
    ),
  ],
};
