import {
  ConvictionMeter,
  EmptyState,
  type GardenSignalPool,
  PoolType,
  ProposalCardConviction,
  useConvictionProposalsForPool,
  useConvictionWeightAllocator,
  usePrimaryAddress,
  WeightAllocator,
  type WeightAllocatorProposal,
} from "@green-goods/shared";
import { RiUserVoiceLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";

interface GovernancePanelProps {
  /** All garden pools — the panel filters to the HypercertSignalPool. */
  pools: GardenSignalPool[];
  /** Garden id for the hypercert metadata fetch. */
  gardenId: string;
}

/**
 * Tier-5 audit-then-ship: net-new conviction-voting surface for the
 * Community → Governance tab. Composes the Tier 3 components
 * (WeightAllocator + ProposalCardConviction + ConvictionMeter) with the
 * Tier-5 adapter hooks (useConvictionProposalsForPool +
 * useConvictionWeightAllocator).
 *
 * Audit findings #7 + #1 + #4 land here. Threshold/accrual values use the
 * conservative fallbacks in src/utils/conviction/derivation.ts until a
 * pool-config hook surfaces the on-chain decay rate + points-per-voter.
 */
export function GovernancePanel({ pools, gardenId }: GovernancePanelProps) {
  const { formatMessage } = useIntl();
  const primaryAddress = usePrimaryAddress();

  const hypercertPool = useMemo(
    () => pools.find((pool) => pool.poolType === PoolType.Hypercert),
    [pools]
  );

  const { proposals, isLoading } = useConvictionProposalsForPool(
    hypercertPool?.poolAddress,
    gardenId,
    primaryAddress ?? undefined
  );

  const allocator = useConvictionWeightAllocator(
    hypercertPool?.poolAddress,
    primaryAddress ?? undefined
  );

  const allocatorProposals = useMemo<WeightAllocatorProposal[]>(
    () => proposals.map((proposal) => ({ id: proposal.id, title: proposal.title })),
    [proposals]
  );

  if (!hypercertPool) {
    return (
      <EmptyState
        icon={<RiUserVoiceLine className="h-6 w-6" />}
        title={formatMessage({
          id: "cockpit.community.governance.noPool.title",
          defaultMessage: "No conviction pool yet",
        })}
        description={formatMessage({
          id: "cockpit.community.governance.noPool.description",
          defaultMessage:
            "Create a HypercertSignalPool from the Community panel to enable conviction voting on this garden's hypercerts.",
        })}
      />
    );
  }

  if (isLoading && proposals.length === 0) {
    return (
      <div className="space-y-3" data-component="GovernancePanel" data-state="loading">
        <div className="h-32 rounded-[var(--r-lg,16px)] skeleton-shimmer" />
        <div className="h-24 rounded-[var(--r-lg,16px)] skeleton-shimmer" />
        <div className="h-24 rounded-[var(--r-lg,16px)] skeleton-shimmer" />
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={<RiUserVoiceLine className="h-6 w-6" />}
        title={formatMessage({
          id: "cockpit.community.governance.empty.title",
          defaultMessage: "No registered proposals yet",
        })}
        description={formatMessage({
          id: "cockpit.community.governance.empty.description",
          defaultMessage:
            "Register hypercerts in this garden's signal pool to surface them here for conviction voting.",
        })}
      />
    );
  }

  return (
    <section
      className="space-y-4"
      data-component="GovernancePanel"
      data-pool-address={hypercertPool.poolAddress}
    >
      {primaryAddress ? (
        <WeightAllocator
          proposals={allocatorProposals}
          allocations={allocator.allocations}
          onChange={allocator.setAllocations}
          disabled={allocator.isLoading || allocator.isSaving}
        />
      ) : (
        <EmptyState
          icon={<RiUserVoiceLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.community.governance.signIn.title",
            defaultMessage: "Sign in to allocate conviction",
          })}
          description={formatMessage({
            id: "cockpit.community.governance.signIn.description",
            defaultMessage:
              "Connect your wallet or sign in to allocate your conviction weight across the proposals below.",
          })}
        />
      )}

      <h3 className="text-title-md font-semibold text-text-strong">
        {formatMessage({
          id: "cockpit.community.governance.proposals.title",
          defaultMessage: "Proposals",
        })}
      </h3>

      <div
        role="list"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        data-slot="proposal-grid"
      >
        {proposals.map((proposal) => (
          <ProposalCardConviction key={proposal.id} proposal={proposal} />
        ))}
      </div>

      <div className="rounded-[var(--r-md,12px)] bg-[var(--surface-quiet,rgb(var(--bg-soft-200)))] p-3 text-label-sm text-text-soft">
        {formatMessage({
          id: "cockpit.community.governance.firstDelivery.note",
          defaultMessage:
            "First delivery: threshold + accrual rates use conservative defaults until the pool-config hook lands. Hypercert metadata resolves from the garden's hypercert registry.",
        })}
        {/* Render meter as a small visual debug aid for the first proposal */}
        {proposals[0] ? (
          <div className="mt-2">
            <ConvictionMeter
              conviction={proposals[0].conviction}
              threshold={proposals[0].threshold}
              dailyAccrual={proposals[0].dailyAccrual}
              status={proposals[0].status}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
