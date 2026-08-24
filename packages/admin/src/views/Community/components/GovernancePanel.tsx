import { ConvictionMeter } from "@green-goods/shared/components/Conviction/ConvictionMeter";
import {
  WeightAllocator,
  type WeightAllocatorProposal,
} from "@green-goods/shared/components/Conviction/WeightAllocator";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useConvictionProposalsForPool } from "@green-goods/shared/hooks/conviction/useConvictionProposalsForPool";
import { useConvictionWeightAllocator } from "@green-goods/shared/hooks/conviction/useConvictionWeightAllocator";
import { type GardenSignalPool, PoolType } from "@green-goods/shared/types/gardens-community";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiArrowRightSLine, RiUserVoiceLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";

interface GovernancePanelProps {
  /** All garden pools — the panel filters to the HypercertSignalPool. */
  pools: GardenSignalPool[];
  /** Garden id for the hypercert metadata fetch. */
  gardenId: string;
}

/**
 * Net-new conviction-voting surface for the
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
    // Skeleton mirrors the loaded structure: pool header, compact proposal
    // rows, then the optional allocator/sign-in block.
    return (
      <section className="space-y-4" data-component="GovernancePanel" data-state="loading">
        <div className="rounded-lg border border-stroke-soft bg-bg-white">
          <div className="flex flex-col gap-3 border-b border-stroke-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="h-5 w-44 rounded-md skeleton-shimmer" />
              <div className="h-4 w-56 rounded-md skeleton-shimmer" />
            </div>
            <div className="h-8 w-28 rounded-md skeleton-shimmer" />
          </div>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="grid gap-3 border-b border-stroke-soft px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_8rem_12rem_auto]"
            >
              <div className="space-y-2">
                <div className="h-5 w-48 rounded-md skeleton-shimmer" />
                <div className="h-4 w-full max-w-md rounded-md skeleton-shimmer" />
              </div>
              <div className="h-5 w-20 rounded-md skeleton-shimmer" />
              <div className="h-5 w-full rounded-md skeleton-shimmer" />
              <div className="h-8 w-20 rounded-md skeleton-shimmer" />
            </div>
          ))}
        </div>
        <div className="h-20 rounded-lg skeleton-shimmer" />
      </section>
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
      <div className="overflow-hidden rounded-lg border border-stroke-soft bg-bg-white">
        <div className="flex flex-col gap-3 border-b border-stroke-soft px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="label-sm text-text-strong">
              {formatMessage({ id: "cockpit.community.coordination.hypercertPool" })}
            </p>
            <p className="mt-1 font-mono text-xs text-text-soft">
              {formatShortAddress(hypercertPool.poolAddress)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-bg-soft px-2 py-0.5 text-xs font-medium text-text-sub">
              {formatMessage(
                { id: "cockpit.community.coordination.proposalCount" },
                { count: proposals.length }
              )}
            </span>
            <AdminButton asChild variant="text" size="sm" className="h-auto rounded p-0">
              <Link to={adminRoutes.communityCoordinationSignalPool("hypercert", { gardenId })}>
                {formatMessage({ id: "cockpit.community.coordination.openPool" })}
                <RiArrowRightSLine className="h-4 w-4" />
              </Link>
            </AdminButton>
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_8rem_12rem_auto] gap-3 border-b border-stroke-soft bg-bg-weak px-4 py-2 text-xs font-medium uppercase tracking-[0.04em] text-text-soft lg:grid">
          <span>{formatMessage({ id: "cockpit.community.coordination.proposal" })}</span>
          <span>{formatMessage({ id: "cockpit.community.coordination.support" })}</span>
          <span>{formatMessage({ id: "cockpit.community.coordination.conviction" })}</span>
          <span className="sr-only">{formatMessage({ id: "app.actions.view" })}</span>
        </div>

        <div role="list" data-slot="proposal-list">
          {proposals.map((proposal) => (
            <article
              key={proposal.id}
              role="listitem"
              className="grid gap-3 border-b border-stroke-soft px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_8rem_12rem_auto] lg:items-center"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-strong">{proposal.title}</h3>
                  <StatusBadge convictionStatus={proposal.status} size="sm" />
                </div>
                {proposal.summary ? (
                  <p className="line-clamp-2 body-sm text-text-sub">{proposal.summary}</p>
                ) : null}
              </div>
              <div className="space-y-1 lg:space-y-0">
                <p className="body-xs text-text-soft lg:hidden">
                  {formatMessage({ id: "cockpit.community.coordination.support" })}
                </p>
                <p className="text-sm font-medium tabular-nums text-text-strong">
                  {formatMessage(
                    { id: "cockpit.community.coordination.supporters" },
                    { count: proposal.supporters }
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="text-text-sub">
                    {Math.round(proposal.conviction)}% / {Math.round(proposal.threshold)}%
                  </span>
                  <span className="text-text-soft">
                    {proposal.dailyAccrual > 0 ? `+${proposal.dailyAccrual.toFixed(1)}%` : "0%"}
                  </span>
                </div>
                <ConvictionMeter
                  conviction={proposal.conviction}
                  threshold={proposal.threshold}
                  dailyAccrual={proposal.dailyAccrual}
                  status={proposal.status}
                  showLabels={false}
                />
              </div>
              <AdminButton asChild variant="text" size="sm" className="justify-self-start">
                <Link to={adminRoutes.communityCoordinationSignalPool("hypercert", { gardenId })}>
                  {formatMessage({ id: "app.actions.view" })}
                  <RiArrowRightSLine className="h-4 w-4" />
                </Link>
              </AdminButton>
            </article>
          ))}
        </div>
      </div>

      {primaryAddress ? (
        <WeightAllocator
          proposals={allocatorProposals}
          allocations={allocator.allocations}
          onChange={allocator.setAllocations}
          disabled={allocator.isLoading || allocator.isSaving}
        />
      ) : (
        <div className="rounded-lg border border-stroke-soft bg-bg-weak px-4 py-3">
          <p className="text-sm font-medium text-text-strong">
            {formatMessage({
              id: "cockpit.community.governance.signIn.title",
              defaultMessage: "Sign in to allocate conviction",
            })}
          </p>
          <p className="mt-1 body-sm text-text-sub">
            {formatMessage({
              id: "cockpit.community.governance.signIn.description",
              defaultMessage:
                "Connect your wallet or sign in to allocate your conviction weight across the proposals below.",
            })}
          </p>
        </div>
      )}
    </section>
  );
}

function formatShortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
