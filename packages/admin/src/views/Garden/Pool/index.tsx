import { usePoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import type { Address } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiSeedlingLine } from "@remixicon/react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { PoolClaimsCard } from "./PoolClaimsCard";
import { type PoolCommitmentScope, PoolCommitmentsCard } from "./PoolCommitmentsCard";
import { PoolCyclesCard } from "./PoolCyclesCard";
import { PoolDialogs } from "./PoolDialogs";
import { PoolStatusCard } from "./PoolStatusCard";
import { PoolStatusCasts } from "./PoolStatusCasts";
import type { ConfirmDialog, FlowState, ReasonDialog } from "./poolDialogState";

export interface GardenPoolTabProps {
  garden: { id: Address; name: string };
  chainId: number;
  canManage: boolean;
  /**
   * Where the seed console and the commitment inspector open. The Garden
   * workspace routes them (`/garden/pool/seed`, `/garden/pool/:id`); the
   * Community → Pools protocol tab hosts the same console for another garden
   * and opens both in place, in its own tone.
   */
  presentation?: {
    inspector: "route" | "dialog";
    tone: "garden" | "community";
    /** Seeding in protocol context: requests default to steward review. */
    protocolContext?: boolean;
  };
}

/**
 * W7, the steward's pool console (uiux-spec §6.2). Two columns: the season
 * and its campaigns, the claims waiting, and the commitments on the left; the
 * pool's own status card on the right. Every act goes through the controller
 * in shared; every reasoned act through the one reason dialog; every row opens
 * in the Garden workspace's left inspector, route-backed.
 */
export function GardenPoolTab({
  garden,
  chainId,
  canManage,
  presentation = { inspector: "route", tone: "garden" },
}: GardenPoolTabProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const pool = usePoolConsoleController({ chainId, garden: garden.id });
  const tone = presentation.tone;
  const [inspected, setInspected] = useState<string | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);
  const [scope, setScope] = useState<PoolCommitmentScope>("open");
  const [dueOnly, setDueOnly] = useState(false);
  const [flow, setFlow] = useState<FlowState>(null);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialog>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { model } = pool;

  const openCommitment = useCallback(
    (commitment: CommitmentReadModel) => {
      if (presentation.inspector === "dialog") {
        setInspected(commitment.commitmentId.toString());
        return;
      }
      navigate(
        adminRoutes.gardenPoolCommitment(commitment.commitmentId.toString(), {
          gardenId: garden.id,
        })
      );
    },
    [navigate, garden.id, presentation.inspector]
  );
  const openSeed = useCallback(() => {
    if (presentation.inspector === "dialog") {
      setSeedOpen(true);
      return;
    }
    navigate(adminRoutes.gardenPoolSeed({ gardenId: garden.id }));
  }, [navigate, garden.id, presentation.inspector]);
  const jumpTo = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const casts = <PoolStatusCasts pool={pool} canManage={canManage} />;
  if (!canManage) return casts;
  if (pool.isLoading || pool.isError || model.status === "unregistered") return casts;
  if (pool.availability.status !== "available" && pool.pool === null) return casts;

  // canManage is guaranteed by the guard above; only pool state and the
  // connection decide whether seeding is offered.
  const canSeed = model.status === "open" && pool.isOnline;
  const preOpen = model.status === "not-ready";
  const finished = model.status === "closed" || model.status === "composted";

  const statusCard = (
    <PoolStatusCard
      console={pool}
      onEditSettings={() => setSettingsOpen(true)}
      onPause={() => setReasonDialog({ kind: "pause" })}
      onClosePool={() => setConfirmDialog("close")}
      onCompostPool={() => setConfirmDialog("compost")}
      onReopenPool={() => setConfirmDialog("reopen")}
      onReviewLive={() => {
        setDueOnly(false);
        setScope("open");
        jumpTo("pool-commitments");
      }}
    />
  );

  const summary =
    !preOpen && !finished ? (
      <div
        className="grid grid-cols-3 gap-2"
        data-component="PoolSummaryRow"
        aria-label={formatMessage({
          id: "cockpit.garden.pool.summary.label",
          defaultMessage: "What needs you",
        })}
      >
        {[
          {
            id: "claims",
            count: model.counts.claimsWaiting,
            label: formatMessage({
              id: "cockpit.garden.pool.summary.claims",
              defaultMessage: "Claims waiting",
            }),
            onClick: () => jumpTo("pool-claims"),
          },
          {
            id: "recovery",
            count: model.counts.needsRecovery,
            label: formatMessage({
              id: "cockpit.garden.pool.summary.recovery",
              defaultMessage: "Needs recovery",
            }),
            onClick: () => {
              setDueOnly(false);
              setScope("open");
              jumpTo("pool-commitments");
            },
          },
          {
            id: "pastDue",
            count: model.counts.pastDue,
            label: formatMessage({
              id: "cockpit.garden.pool.summary.pastDue",
              defaultMessage: "Past due",
            }),
            onClick: () => {
              setDueOnly(true);
              jumpTo("pool-commitments");
            },
          },
        ].map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={stat.onClick}
            className="m3-state-layer rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2 text-left [--state-layer-color:var(--m3-on-surface)]"
          >
            <span className="block text-lg font-semibold text-text-strong">{stat.count}</span>
            <span className="block text-xs text-text-soft">{stat.label}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
      data-component="GardenPoolTab"
      data-region="garden-pool"
    >
      <div className="space-y-4">
        {summary}

        {preOpen ? (
          <AdminCard
            variant="elevated"
            className="flex min-h-56 flex-col items-center justify-center gap-3 text-center"
          >
            <RiSeedlingLine className="h-6 w-6 text-text-soft" aria-hidden />
            <p className="label-md text-text-strong">
              {formatMessage({
                id: "cockpit.garden.pool.notReady.title",
                defaultMessage: "This garden isn’t taking commitments yet",
              })}
            </p>
            <p className="max-w-md text-sm text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.notReady.body",
                defaultMessage:
                  "Neighbours can offer help and ask for it here once you’ve set up how this pool works.",
              })}
            </p>
            <AdminButton
              type="button"
              variant="filled"
              onClick={() => setFlow({ intent: "first-run" })}
              disabled={!pool.isOnline}
            >
              {formatMessage({
                id: "cockpit.garden.pool.act.setUp",
                defaultMessage: "Set up commitments",
              })}
            </AdminButton>
          </AdminCard>
        ) : finished ? null : (
          <PoolCyclesCard
            console={pool}
            onStartSeason={() => setFlow({ intent: "season" })}
            onOpenSeason={(cycle) => setFlow({ intent: "open-season", cycle })}
            onStartCampaign={() => setFlow({ intent: "campaign" })}
            onOpenCampaign={(cycle) => setFlow({ intent: "open-campaign", cycle })}
            onCancelCycle={(cycle) => setReasonDialog({ kind: "cancel-cycle", cycle })}
          />
        )}

        {!preOpen && !finished ? (
          <PoolClaimsCard
            console={pool}
            onDecline={(row) => setReasonDialog({ kind: "decline-claim", row })}
          />
        ) : null}

        {!preOpen ? (
          <PoolCommitmentsCard
            console={pool}
            scope={scope}
            onScopeChange={setScope}
            dueOnly={dueOnly}
            onDueOnlyChange={setDueOnly}
            onOpenCommitment={openCommitment}
            onSeed={openSeed}
            canSeed={canSeed}
          />
        ) : null}
      </div>

      <aside className="space-y-4">{statusCard}</aside>

      <PoolDialogs
        pool={pool}
        garden={garden}
        chainId={chainId}
        tone={tone}
        presentation={presentation}
        flow={flow}
        setFlow={setFlow}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        seedOpen={seedOpen}
        setSeedOpen={setSeedOpen}
        inspected={inspected}
        setInspected={setInspected}
        reasonDialog={reasonDialog}
        setReasonDialog={setReasonDialog}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
      />
    </div>
  );
}
