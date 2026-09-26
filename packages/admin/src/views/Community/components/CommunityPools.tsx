import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import {
  type CommitmentsToConfirm,
  useCommitmentsToConfirm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import {
  useIsProtocolGarden,
  type useProtocolPool,
} from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import type { Address } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiArrowRightLine, RiRefreshLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { poolStatusChip } from "@/views/Garden/Pool/poolPresentation";
import { HubConfirmQueue } from "@/views/Hub/components/HubConfirmQueue";
import { ProtocolFundingOperationsPanel } from "./ProtocolFundingOperationsPanel";
import { SettlementOperationsPanel } from "./SettlementOperationsCard";

export interface CommunityPoolsProps {
  chainId: number;
  garden: { id: Address; name: string };
  canManage: boolean;
}

/**
 * Community → Coordination's pooling section. It only ever speaks for the
 * garden selected in the header: that garden's pool, one tap from its console
 * in the Garden workspace. The protocol's own work (settlement, protocol
 * funding, the confirmations the team was asked to step into) appears here
 * only when the selected garden is the Green Goods Community Garden, whose
 * pool the protocol pool is. No other garden's Community tab can reach it, so
 * no setup, edit, or pause of the protocol pool starts from a garden that
 * isn't it.
 */
export function CommunityPools({ chainId, garden, canManage }: CommunityPoolsProps) {
  const { isProtocolGarden, protocolPool, ownPool, ownPoolsLoading } = useIsProtocolGarden({
    chainId,
    gardenId: garden.id,
  });

  return (
    <div
      className="space-y-4"
      data-component="CommunityPools"
      data-region="community-pools"
      data-tone="community"
    >
      <GardenPoolCard
        garden={garden}
        canManage={canManage}
        isLoading={ownPoolsLoading}
        pool={ownPool}
      />
      {isProtocolGarden ? (
        <ProtocolOperations chainId={chainId} protocolPool={protocolPool} />
      ) : null}
    </div>
  );
}

function GardenPoolCard({
  garden,
  canManage,
  isLoading,
  pool,
}: {
  garden: CommunityPoolsProps["garden"];
  canManage: boolean;
  isLoading: boolean;
  pool: { state: string | null; openSeasonCycleId: bigint | null } | null;
}) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const chip = poolStatusChip(
    pool ? statusOf(pool.state) : "unregistered",
    Boolean(pool?.openSeasonCycleId),
    formatMessage
  );
  return (
    <AdminCard variant="elevated" className="space-y-3" data-testid="current-garden-pool">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <AdminCardTitle className="truncate" title={garden.name}>
            {garden.name}
          </AdminCardTitle>
          <p className="mt-1 body-xs text-text-soft">
            {formatMessage({
              id: "cockpit.community.pools.currentGardenHint",
              defaultMessage:
                "This garden's pool runs from the Garden workspace. One tap takes you there; nothing is duplicated here.",
            })}
          </p>
        </div>
        {isLoading ? null : (
          <StatusBadge variant={chip.variant} size="sm">
            {pool
              ? chip.label
              : formatMessage({
                  id: "cockpit.garden.pool.unregistered.title",
                  defaultMessage: "This garden has no commitment pool",
                })}
          </StatusBadge>
        )}
      </div>
      <AdminButton
        type="button"
        variant="filled"
        leadingIcon={<RiArrowRightLine className="h-4 w-4" />}
        onClick={() => navigate(adminRoutes.gardenPool({ gardenId: garden.id }))}
        disabled={!canManage}
      >
        {formatMessage({
          id: "cockpit.community.pools.openConsole",
          defaultMessage: "Open the Pool Console",
        })}
      </AdminButton>
      {!canManage ? (
        <p className="body-xs text-text-soft">
          {formatMessage({
            id: "cockpit.community.pools.stewardOnly",
            defaultMessage: "The pool console is for this garden's stewards.",
          })}
        </p>
      ) : null}
    </AdminCard>
  );
}

/**
 * The protocol's own operations, shown only inside the Green Goods Community
 * Garden: settlement, protocol funding, and the cross-garden confirmations the
 * team was asked to step into. The protocol pool's console itself is that
 * garden's Pool tab, like every other garden's.
 */
function ProtocolOperations({
  chainId,
  protocolPool,
}: {
  chainId: number;
  protocolPool: ReturnType<typeof useProtocolPool>;
}) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const toConfirm = useCommitmentsToConfirm({
    chainId,
    viewer: (primaryAddress ?? undefined) as Address | undefined,
    includeProtocolFallback: true,
  });
  // Only the cross-garden rows the team was asked to step into. A reader who
  // also stewards ordinary gardens carries those gardens' own confirmations
  // and disputes in the same object, and none of them belong under a heading
  // that promises no other garden's pool is browsed here.
  const protocolToConfirm = useMemo<CommitmentsToConfirm>(() => {
    const fallback = toConfirm.fallback.filter((row) => row.path === "PROTOCOL_FALLBACK");
    return { ...toConfirm, groups: [], fallback, disputed: [], count: fallback.length };
  }, [toConfirm]);
  const [selectedCommitment, setSelectedCommitment] = useState<string | undefined>(undefined);

  if (protocolPool.isLoading) {
    return (
      <div
        className="space-y-3"
        role="status"
        aria-label={formatMessage({
          id: "cockpit.community.pools.loading",
          defaultMessage: "Loading the protocol pool",
        })}
      >
        <div className="h-16 rounded-[var(--m3-shape-md)] skeleton-shimmer" aria-hidden />
        <div className="h-40 rounded-[var(--m3-shape-md)] skeleton-shimmer" aria-hidden />
      </div>
    );
  }
  if (protocolPool.isError) {
    return (
      <AdminCard
        variant="elevated"
        className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"
      >
        <AdminCardTitle>
          {formatMessage({
            id: "cockpit.community.pools.readError.title",
            defaultMessage: "Couldn’t read the protocol pool",
          })}
        </AdminCardTitle>
        <p className="max-w-md body-sm text-text-soft">
          {formatMessage({
            id: "cockpit.community.pools.readError.body",
            defaultMessage:
              "The module could not be reached. Nothing about the protocol pool has changed.",
          })}
        </p>
        <AdminButton
          type="button"
          variant="filled"
          leadingIcon={<RiRefreshLine className="h-4 w-4" />}
          onClick={() => void protocolPool.refetch()}
        >
          {formatMessage({
            id: "cockpit.garden.pool.readError.retry",
            defaultMessage: "Try Again",
          })}
        </AdminButton>
      </AdminCard>
    );
  }
  if (!protocolPool.isRegistered || !protocolPool.rootGarden) {
    return (
      <AdminCard variant="elevated" className="space-y-2" data-testid="protocol-pool-unregistered">
        <AdminCardTitle>
          {formatMessage({
            id: "cockpit.community.pools.unregistered.title",
            defaultMessage: "No protocol pool is registered yet",
          })}
        </AdminCardTitle>
        <p className="body-sm text-text-soft">
          {formatMessage({
            id: "cockpit.community.pools.unregistered.body",
            defaultMessage:
              "Registering it is a deployment operation by the Green Goods team. Until then, the team cannot step in as a fallback confirmer anywhere.",
          })}
        </p>
      </AdminCard>
    );
  }
  return (
    <div className="space-y-4" data-testid="protocol-pool">
      <SettlementOperationsPanel chainId={chainId} />
      <ProtocolFundingOperationsPanel chainId={chainId} protocolGarden={protocolPool.rootGarden} />
      {toConfirm.isProtocolSteward ? (
        <section
          className="space-y-2"
          aria-label={formatMessage({
            id: "cockpit.community.pools.confirmations",
            defaultMessage: "Protocol Confirmations",
          })}
        >
          <AdminCardTitle>
            {formatMessage({
              id: "cockpit.community.pools.confirmations",
              defaultMessage: "Protocol Confirmations",
            })}
          </AdminCardTitle>
          <p className="body-xs text-text-soft">
            {formatMessage({
              id: "cockpit.community.pools.confirmationsHint",
              defaultMessage:
                "Commitments from any garden that opted in and that nobody local can still confirm. Only these rows reach the team; no other garden's pool is browsed here.",
            })}
          </p>
          <HubConfirmQueue
            toConfirm={protocolToConfirm}
            chainId={chainId}
            normalizedSearch=""
            selectedCommitmentId={selectedCommitment}
            onOpenCommitment={setSelectedCommitment}
            onCloseCommitment={() => setSelectedCommitment(undefined)}
          />
        </section>
      ) : null}
    </div>
  );
}

function statusOf(state: string | null) {
  switch (state) {
    case "NOT_READY":
      return "not-ready" as const;
    case "READY":
      return "ready" as const;
    case "OPEN":
      return "open" as const;
    case "PAUSED":
      return "paused" as const;
    case "CLOSED":
      return "closed" as const;
    case "COMPOSTED":
      return "composted" as const;
    default:
      return "unknown" as const;
  }
}
