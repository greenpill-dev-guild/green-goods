import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import type { Address } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useCommitmentPools } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import {
  type CommitmentsToConfirm,
  useCommitmentsToConfirm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import { useProtocolPool } from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import { RiArrowRightLine, RiRefreshLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminTabRail } from "@/components/AdminTabRail";
import { GardenPoolTab } from "@/views/Garden/Pool";
import { poolStatusChip } from "@/views/Garden/Pool/poolPresentation";
import { HubConfirmQueue } from "@/views/Hub/components/HubConfirmQueue";

export interface CommunityPoolsProps {
  chainId: number;
  garden: { id: Address; name: string };
  canManage: boolean;
}

type PoolsTab = "protocol" | "current";

/**
 * W12, Community → Pools (uiux-spec §6.8): exactly the protocol pool and
 * this garden's pool, never another garden's. The Protocol pool tab is the
 * protocol stewards' home: the root garden's pool console (cross-garden
 * claims, seeding in protocol context) plus the protocol confirmations queue
 * in the Hub Confirm grammar. This garden is one tap into the pool console,
 * with no duplicated grammar. The funding view and the delivery-gate row are
 * out of scope here and say nothing.
 */
export function CommunityPools({ chainId, garden, canManage }: CommunityPoolsProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PoolsTab>("protocol");
  const protocolPool = useProtocolPool({ chainId });
  const { primaryAddress } = useUser();
  const toConfirm = useCommitmentsToConfirm({
    chainId,
    viewer: (primaryAddress ?? undefined) as Address | undefined,
    includeProtocolFallback: true,
  });
  // Stewarding the registered protocol garden is what the queue already
  // checks; the console's write authority is the same Hat.
  const isProtocolSteward = toConfirm.isProtocolSteward;
  // Only the cross-garden rows the team was asked to step into. A reader who
  // also stewards ordinary gardens carries those gardens' own confirmations
  // and disputes in the same object, and none of them belong under a heading
  // that promises no other garden's pool is browsed here.
  const protocolToConfirm = useMemo<CommitmentsToConfirm>(() => {
    const fallback = toConfirm.fallback.filter((row) => row.path === "PROTOCOL_FALLBACK");
    return { ...toConfirm, groups: [], fallback, disputed: [], count: fallback.length };
  }, [toConfirm]);
  const ownPools = useCommitmentPools({ chainId, garden: garden.id });
  const ownPool = ownPools.pools[0] ?? null;
  const [selectedCommitment, setSelectedCommitment] = useState<string | undefined>(undefined);

  return (
    <div
      className="space-y-4"
      data-component="CommunityPools"
      data-region="community-pools"
      data-tone="community"
    >
      <AdminTabRail
        ariaLabel={formatMessage({ id: "cockpit.community.pools.rail", defaultMessage: "Pools" })}
        activeId={tab}
        onChange={(next) => setTab(next as PoolsTab)}
        tabs={[
          {
            id: "protocol",
            label: formatMessage({
              id: "cockpit.community.pools.protocol",
              defaultMessage: "Protocol pool",
            }),
            count: toConfirm.isProtocolSteward ? protocolToConfirm.count || undefined : undefined,
          },
          {
            id: "current",
            label: formatMessage({
              id: "cockpit.community.pools.currentGarden",
              defaultMessage: "This garden",
            }),
          },
        ]}
      />

      {tab === "protocol" ? (
        protocolPool.isLoading ? (
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
        ) : protocolPool.isError ? (
          <AdminCard
            variant="elevated"
            className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"
          >
            <p className="label-md text-text-strong">
              {formatMessage({
                id: "cockpit.community.pools.readError.title",
                defaultMessage: "Couldn’t read the protocol pool",
              })}
            </p>
            <p className="max-w-md text-sm text-text-soft">
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
                defaultMessage: "Try again",
              })}
            </AdminButton>
          </AdminCard>
        ) : !protocolPool.isRegistered || !protocolPool.rootGarden ? (
          <AdminCard
            variant="elevated"
            className="space-y-2"
            data-testid="protocol-pool-unregistered"
          >
            <p className="label-md text-text-strong">
              {formatMessage({
                id: "cockpit.community.pools.unregistered.title",
                defaultMessage: "No protocol pool is registered yet",
              })}
            </p>
            <p className="text-sm text-text-soft">
              {formatMessage({
                id: "cockpit.community.pools.unregistered.body",
                defaultMessage:
                  "Registering it is a deployment operation by the Green Goods team. Until then, the team cannot step in as a fallback confirmer anywhere.",
              })}
            </p>
          </AdminCard>
        ) : (
          <div className="space-y-4" data-testid="protocol-pool">
            {toConfirm.isProtocolSteward ? (
              <section
                className="space-y-2"
                aria-label={formatMessage({
                  id: "cockpit.community.pools.confirmations",
                  defaultMessage: "Protocol confirmations",
                })}
              >
                <h3 className="label-md text-text-strong">
                  {formatMessage({
                    id: "cockpit.community.pools.confirmations",
                    defaultMessage: "Protocol confirmations",
                  })}
                </h3>
                <p className="text-xs text-text-soft">
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
            <GardenPoolTab
              garden={{
                id: protocolPool.rootGarden,
                name: formatMessage({
                  id: "cockpit.community.pools.protocolGardenName",
                  defaultMessage: "Green Goods",
                }),
              }}
              chainId={chainId}
              canManage={isProtocolSteward}
              presentation={{ inspector: "dialog", tone: "community", protocolContext: true }}
            />
          </div>
        )
      ) : (
        <AdminCard variant="elevated" className="space-y-3" data-testid="current-garden-pool">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="label-md text-text-strong" title={garden.name}>
                {garden.name}
              </h3>
              <p className="mt-1 text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.community.pools.currentGardenHint",
                  defaultMessage:
                    "This garden's pool runs from the Garden workspace. One tap takes you there; nothing is duplicated here.",
                })}
              </p>
            </div>
            {ownPools.isLoading ? null : (
              <StatusBadge
                variant={
                  poolStatusChip(
                    ownPool ? statusOf(ownPool.state) : "unregistered",
                    Boolean(ownPool?.openSeasonCycleId),
                    formatMessage
                  ).variant
                }
                size="sm"
              >
                {ownPool
                  ? poolStatusChip(
                      statusOf(ownPool.state),
                      Boolean(ownPool.openSeasonCycleId),
                      formatMessage
                    ).label
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
              defaultMessage: "Open the pool console",
            })}
          </AdminButton>
          {!canManage ? (
            <p className="text-xs text-text-soft">
              {formatMessage({
                id: "cockpit.community.pools.stewardOnly",
                defaultMessage: "The pool console is for this garden's stewards.",
              })}
            </p>
          ) : null}
        </AdminCard>
      )}
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
