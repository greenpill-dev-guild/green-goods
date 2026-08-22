import {
  type Address,
  adminRoutes,
  type CommitmentCycleRecord,
  type CommitmentReadModel,
  type PoolClaimRequestRow,
  usePoolConsoleController,
} from "@green-goods/shared";
import { RiRefreshLine, RiSeedlingLine, RiWifiOffLine } from "@remixicon/react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminConfirmDialog, AdminDialog } from "@/components/AdminDialog";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { PoolClaimsCard } from "./PoolClaimsCard";
import { PoolCommitmentsCard, type PoolCommitmentScope } from "./PoolCommitmentsCard";
import { CommitmentDialogPanel } from "./CommitmentDialog";
import { PoolCyclesCard } from "./PoolCyclesCard";
import { PoolSettingsDialog } from "./PoolSettingsDialog";
import { SeedCommitmentDialog } from "./Seed";
import { PoolStatusCard } from "./PoolStatusCard";
import { cycleName } from "./poolPresentation";
import { PoolSetupFlow, type PoolSetupIntent } from "./SetupFlow";

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

type FlowState = { intent: PoolSetupIntent; cycle?: CommitmentCycleRecord | null } | null;
type ReasonDialog =
  | { kind: "pause" }
  | { kind: "cancel-cycle"; cycle: CommitmentCycleRecord }
  | { kind: "decline-claim"; row: PoolClaimRequestRow }
  | null;
type ConfirmDialog = "close" | "compost" | "reopen" | null;

function SkeletonRail() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-24 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
      <div className="h-40 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
    </div>
  );
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

  if (pool.isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
        role="status"
        aria-label={formatMessage({
          id: "cockpit.garden.pool.loading",
          defaultMessage: "Loading the pool",
        })}
        data-component="GardenPoolTab"
      >
        <div className="space-y-3" aria-hidden>
          <div className="h-16 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
          <div className="h-40 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
          <div className="h-56 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
        </div>
        <SkeletonRail />
      </div>
    );
  }

  if (pool.isError) {
    return (
      <AdminCard
        variant="elevated"
        data-component="GardenPoolTab"
        className="flex min-h-56 flex-col items-center justify-center gap-3 text-center"
      >
        <RiWifiOffLine className="h-6 w-6 text-text-soft" aria-hidden />
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.readError.title",
            defaultMessage: "Couldn’t load this pool",
          })}
        </p>
        <p className="max-w-md text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.readError.body",
            defaultMessage:
              "Something went wrong reaching the indexer. Nothing about the pool, its seasons, or its commitments has changed.",
          })}
        </p>
        <AdminButton
          type="button"
          variant="filled"
          leadingIcon={<RiRefreshLine className="h-4 w-4" />}
          onClick={() => void pool.refetch()}
        >
          {formatMessage({
            id: "cockpit.garden.pool.readError.retry",
            defaultMessage: "Try again",
          })}
        </AdminButton>
      </AdminCard>
    );
  }

  if (pool.availability.status !== "available") {
    return (
      <AdminCard variant="elevated" data-component="GardenPoolTab" className="space-y-2">
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.unavailable.title",
            defaultMessage: "Commitment pooling is not on this chain yet",
          })}
        </p>
        <p className="text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.unavailable.body",
            defaultMessage:
              "The pool console switches on with the release that serves pooling here.",
          })}
        </p>
      </AdminCard>
    );
  }

  if (model.status === "unregistered") {
    return (
      <AdminCard variant="elevated" data-component="GardenPoolTab" className="space-y-2">
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.unregistered.title",
            defaultMessage: "This garden has no commitment pool",
          })}
        </p>
        <p className="text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.unregistered.body",
            defaultMessage:
              "A pool is registered for a garden by the Green Goods team. Once it is, setting it up happens here.",
          })}
        </p>
      </AdminCard>
    );
  }

  const canSeed =
    canManage &&
    model.status === "open" &&
    pool.isOnline &&
    pool.availability.status === "available";
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
            {canManage ? (
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
            ) : null}
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

      <PoolSetupFlow
        open={flow !== null}
        intent={flow?.intent ?? "first-run"}
        cycle={flow?.cycle ?? null}
        console={pool}
        onClose={() => setFlow(null)}
      />

      <PoolSettingsDialog
        console={pool}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {presentation.inspector === "dialog" ? (
        <>
          <SeedCommitmentDialog
            open={seedOpen}
            chainId={chainId}
            garden={garden.id}
            onClose={() => setSeedOpen(false)}
            protocolContext={presentation.protocolContext}
          />
          <AdminDialog
            open={inspected !== null}
            onOpenChange={(next) => {
              if (!next) setInspected(null);
            }}
            size="lg"
            tone={tone}
            title={formatMessage({
              id: "cockpit.garden.pool.commitment.title",
              defaultMessage: "Commitment",
            })}
            bodyClassName="p-0"
          >
            {inspected ? (
              <CommitmentDialogPanel
                chainId={chainId}
                garden={garden.id}
                commitmentId={inspected}
                tone={tone}
              />
            ) : null}
          </AdminDialog>
        </>
      ) : null}

      <AdminReasonDialog
        isOpen={reasonDialog?.kind === "pause"}
        onClose={() => setReasonDialog(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.pause.title",
          defaultMessage: "Pause this pool",
        })}
        description={formatMessage(
          {
            id: "cockpit.garden.pool.pause.description",
            defaultMessage:
              "Pausing stops new commitments, claims, and confirmations across {count, plural, one {# open commitment} other {# open commitments}}. Proof, work linkage, and recovery stay open; resuming clears this reason.",
          },
          { count: model.groups.open.length }
        )}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.pause.confirm",
          defaultMessage: "Pause pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.pause.keep",
          defaultMessage: "Keep running",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.pause.suggestion.weather",
            defaultMessage: "Weather or season",
          }),
          formatMessage({
            id: "cockpit.garden.pool.pause.suggestion.regroup",
            defaultMessage: "Group is regrouping",
          }),
          formatMessage({
            id: "cockpit.garden.pool.pause.suggestion.safety",
            defaultMessage: "Safety first",
          }),
        ]}
        blockedReason={
          pool.isOnline
            ? undefined
            : formatMessage({
                id: "cockpit.garden.pool.offline",
                defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
              })
        }
        onConfirm={async (reason) => {
          await pool.acts.pause(reason);
          setReasonDialog(null);
        }}
      />

      <AdminReasonDialog
        isOpen={reasonDialog?.kind === "cancel-cycle"}
        onClose={() => setReasonDialog(null)}
        tone={tone}
        variant="danger"
        title={
          reasonDialog?.kind === "cancel-cycle" && reasonDialog.cycle.cycleType === "CAMPAIGN"
            ? formatMessage({
                id: "cockpit.garden.pool.cancelCycle.campaignTitle",
                defaultMessage: "Cancel this campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.cancelCycle.seasonTitle",
                defaultMessage: "Cancel this season",
              })
        }
        description={formatMessage(
          {
            id: "cockpit.garden.pool.cancelCycle.description",
            defaultMessage:
              "“{name}” has no live commitments. Cancelling ends it for everyone in it; each commitment keeps its own record, and members see the reason you give here.",
          },
          {
            name:
              reasonDialog?.kind === "cancel-cycle"
                ? cycleName(reasonDialog.cycle, pool.cycleNames, formatMessage)
                : "",
          }
        )}
        confirmLabel={
          reasonDialog?.kind === "cancel-cycle" && reasonDialog.cycle.cycleType === "CAMPAIGN"
            ? formatMessage({
                id: "cockpit.garden.pool.cancelCycle.confirmCampaign",
                defaultMessage: "Cancel campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.cancelCycle.confirmSeason",
                defaultMessage: "Cancel season",
              })
        }
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.cancelCycle.keep",
          defaultMessage: "Keep it",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.cancelCycle.suggestion.funding",
            defaultMessage: "Funding fell through",
          }),
          formatMessage({
            id: "cockpit.garden.pool.cancelCycle.suggestion.replanned",
            defaultMessage: "Replanned",
          }),
          formatMessage({
            id: "cockpit.garden.pool.cancelCycle.suggestion.mistake",
            defaultMessage: "Started by mistake",
          }),
        ]}
        blockedReason={
          pool.isOnline
            ? undefined
            : formatMessage({
                id: "cockpit.garden.pool.offline",
                defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
              })
        }
        onConfirm={async (reason) => {
          if (reasonDialog?.kind !== "cancel-cycle") return;
          await pool.acts.cancelCycle(reasonDialog.cycle.cycleId, reason);
          setReasonDialog(null);
        }}
      />

      <AdminReasonDialog
        isOpen={reasonDialog?.kind === "decline-claim"}
        onClose={() => setReasonDialog(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.declineClaim.title",
          defaultMessage: "Decline this request",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.declineClaim.description",
          defaultMessage:
            "Only this request is declined; others stay pending and the commitment stays claimable. The person sees your reason and may ask again.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.declineClaim.confirm",
          defaultMessage: "Decline request",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.declineClaim.keep",
          defaultMessage: "Keep pending",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.declineClaim.suggestion.full",
            defaultMessage: "Crew is full",
          }),
          formatMessage({
            id: "cockpit.garden.pool.declineClaim.suggestion.experience",
            defaultMessage: "Needs more experience",
          }),
          formatMessage({
            id: "cockpit.garden.pool.declineClaim.suggestion.chosen",
            defaultMessage: "Asked after another was chosen",
          }),
        ]}
        blockedReason={
          pool.isOnline
            ? undefined
            : formatMessage({
                id: "cockpit.garden.pool.offline",
                defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
              })
        }
        onConfirm={async (reason) => {
          if (reasonDialog?.kind !== "decline-claim") return;
          await pool.acts.declineClaim(
            reasonDialog.row.claim.commitmentId,
            reasonDialog.row.claim.claimant,
            reason
          );
          setReasonDialog(null);
        }}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "close"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        variant="danger"
        title={formatMessage({
          id: "cockpit.garden.pool.close.title",
          defaultMessage: "Close this pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.close.description",
          defaultMessage:
            "Closing ends participation for every member. Every cycle is finished and no commitment is live; history stays with the garden. Archiving and reopening stay available.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.close.confirm",
          defaultMessage: "Close pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.close.keep",
          defaultMessage: "Keep open",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.closePool();
          setConfirmDialog(null);
        }}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "compost"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        variant="warning"
        title={formatMessage({
          id: "cockpit.garden.pool.compost.title",
          defaultMessage: "Archive this pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.compost.description",
          defaultMessage:
            "Archiving keeps this closed pool’s seasons, commitments, reasons, and history readable. Reopening later begins from set-up.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.compost.confirm",
          defaultMessage: "Archive pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.compost.keep",
          defaultMessage: "Keep closed",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.compostPool();
          setConfirmDialog(null);
        }}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "reopen"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.reopen.title",
          defaultMessage: "Reopen this pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.reopen.description",
          defaultMessage:
            "Reopening moves the archived pool back to set-up. Members still cannot take part until a season opens again; history is preserved.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.reopen.confirm",
          defaultMessage: "Reopen to set-up",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.reopen.keep",
          defaultMessage: "Keep archived",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.reopenPool(false);
          setConfirmDialog(null);
        }}
      />
    </div>
  );
}
