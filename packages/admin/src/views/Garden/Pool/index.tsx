import { usePoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import type { Address } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminCard } from "@/components/AdminCard";
import { PoolClaimsCard } from "./PoolClaimsCard";
import {
  type PoolCommitmentFocus,
  type PoolCommitmentScope,
  PoolCommitmentsCard,
} from "./PoolCommitmentsCard";
import { PoolCyclesCard } from "./PoolCyclesCard";
import { PoolDialogs } from "./PoolDialogs";
import { PoolFundingDialog } from "./PoolFundingDialog";
import { PoolFundingSection } from "./PoolFundingSection";
import { PoolNotReadyCard } from "./PoolNotReadyCard";
import { PoolStatsCard } from "./PoolStatsCard";
import { PoolStatusCard } from "./PoolStatusCard";
import { PoolStatusCasts } from "./PoolStatusCasts";
import type { ConfirmDialog, CycleDialog, FlowState, ReasonDialog } from "./poolDialogState";

export interface GardenPoolTabProps {
  garden: { id: Address; name: string };
  chainId: number;
  canManage: boolean;
}

/**
 * W7, the steward's pool console (uiux-spec §6.2). Two columns: the season
 * and its campaigns, the claims waiting, and the commitments on the left; the
 * pool's own status card on the right. Every act goes through the controller
 * in shared; every reasoned act through the one reason dialog; every row opens
 * in the Garden workspace's left inspector, route-backed.
 *
 * The console lives here and nowhere else, and it only ever acts on the pool
 * of the garden the workspace has selected. The protocol pool is the Green
 * Goods Community Garden's own pool, so it is managed from that garden, in
 * protocol context because the pool says it is the protocol's, not because of
 * where the console was mounted.
 */
export function GardenPoolTab({ garden, chainId, canManage }: GardenPoolTabProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const pool = usePoolConsoleController({ chainId, garden: garden.id });
  const tone = "garden" as const;
  const isProtocolPool = pool.pool?.poolType === "PROTOCOL";
  const target = { gardenName: garden.name, isProtocol: isProtocolPool };
  const [scope, setScope] = useState<PoolCommitmentScope>("open");
  const [focus, setFocus] = useState<PoolCommitmentFocus>(null);
  const [flow, setFlow] = useState<FlowState>(null);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialog>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [cycleDialog, setCycleDialog] = useState<CycleDialog>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fundingOpen, setFundingOpen] = useState(false);
  const fundingDetailsButtonRef = useRef<HTMLButtonElement>(null);
  const { model } = pool;

  const openCommitment = useCallback(
    (commitment: CommitmentReadModel) => {
      navigate(
        adminRoutes.gardenPoolCommitment(commitment.commitmentId.toString(), {
          gardenId: garden.id,
        })
      );
    },
    [navigate, garden.id]
  );
  const openSeed = useCallback(() => {
    navigate(adminRoutes.gardenPoolSeed({ gardenId: garden.id }));
  }, [navigate, garden.id]);
  const jumpTo = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const casts = <PoolStatusCasts pool={pool} canManage={canManage} />;
  const fundingDialog = (
    <PoolFundingDialog
      open={fundingOpen}
      onOpenChange={setFundingOpen}
      funding={pool.funding}
      protocolContext={isProtocolPool}
      tone={tone}
      returnFocusRef={fundingDetailsButtonRef}
    />
  );
  if (!canManage) {
    return (
      <div className="space-y-4" data-component="GardenPoolReaderView">
        {casts}
        <AdminCard variant="elevated">
          <PoolFundingSection
            funding={pool.funding}
            protocolContext={isProtocolPool}
            onOpenDetails={() => setFundingOpen(true)}
            detailsButtonRef={fundingDetailsButtonRef}
          />
        </AdminCard>
        {fundingDialog}
      </div>
    );
  }
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
        setFocus(null);
        setScope("open");
        jumpTo("pool-commitments");
      }}
      onOpenFundingDetails={() => setFundingOpen(true)}
      protocolContext={isProtocolPool}
      fundingDetailsButtonRef={fundingDetailsButtonRef}
    />
  );

  // Each count lands on exactly what it counts (interaction-patterns §5).
  const openFocus = (next: PoolCommitmentFocus) => {
    setScope("open");
    setFocus(next);
    jumpTo("pool-commitments");
  };
  const summary =
    !preOpen && !finished ? (
      <PoolStatsCard
        label={formatMessage({
          id: "cockpit.garden.pool.summary.label",
          defaultMessage: "What needs you",
        })}
        stats={[
          {
            id: "claims",
            count: model.counts.claimsWaiting,
            label: formatMessage({
              id: "cockpit.garden.pool.summary.claims",
              defaultMessage: "Claims waiting",
            }),
            onOpen: () => jumpTo("pool-claims"),
          },
          {
            id: "recovery",
            count: model.counts.needsRecovery,
            label: formatMessage({
              id: "cockpit.garden.pool.summary.recovery",
              defaultMessage: "Needs recovery",
            }),
            onOpen: () => openFocus("recovery"),
          },
          {
            id: "pastDue",
            count: model.counts.pastDue,
            label: formatMessage({
              id: "cockpit.garden.pool.summary.pastDue",
              defaultMessage: "Past due",
            }),
            onOpen: () => openFocus("pastDue"),
          },
        ]}
      />
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
          <PoolNotReadyCard
            isOnline={pool.isOnline}
            onSetUp={() => setFlow({ intent: "first-run" })}
          />
        ) : finished ? null : (
          <PoolCyclesCard
            console={pool}
            onStartSeason={() => setFlow({ intent: "season" })}
            onOpenSeason={(cycle) => setFlow({ intent: "open-season", cycle })}
            onStartCampaign={() => setFlow({ intent: "campaign" })}
            onOpenCampaign={(cycle) => setFlow({ intent: "open-campaign", cycle })}
            onCancelCycle={(cycle) => setReasonDialog({ kind: "cancel-cycle", cycle })}
            onEndCycle={(cycle) => setCycleDialog({ kind: "end", cycle })}
            onArchiveCycle={(cycle) => setCycleDialog({ kind: "archive", cycle })}
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
            focus={focus}
            onFocusChange={setFocus}
            onOpenCommitment={openCommitment}
            onSeed={openSeed}
            canSeed={canSeed}
            tone={tone}
          />
        ) : null}
      </div>

      <aside className="space-y-4">{statusCard}</aside>

      <PoolDialogs
        pool={pool}
        target={target}
        tone={tone}
        flow={flow}
        setFlow={setFlow}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        reasonDialog={reasonDialog}
        setReasonDialog={setReasonDialog}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        cycleDialog={cycleDialog}
        setCycleDialog={setCycleDialog}
      />
      {fundingDialog}
    </div>
  );
}
