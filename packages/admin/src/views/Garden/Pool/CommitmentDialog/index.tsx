import type { DisputeResolutionKey } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useCommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/useCommitmentDialogController";
import { useSettlementAccount } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import { rewardCentsAsSet } from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { Address } from "@green-goods/shared/types/domain";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { CommitmentActions } from "./CommitmentActions";
import { CommitmentAlerts } from "./CommitmentAlerts";
import { CommitmentAssessmentDialog } from "./CommitmentAssessmentDialog";
import { CommitmentClaims, CommitmentRoster } from "./CommitmentClaims";
import {
  CommitmentDialogLoading,
  CommitmentDialogNotFound,
  CommitmentDialogUnavailable,
} from "./CommitmentDialogStates";
import { CommitmentFacts } from "./CommitmentFacts";
import {
  CommitmentDeclineClaimDialog,
  CommitmentFallbackDialog,
  CommitmentReasonDialogs,
} from "./CommitmentReasonDialogs";
import { CommitmentExpireDialog } from "../CommitmentExpireDialog";
import { EditRewardDialog } from "../Group/EditRewardDialog";
import { GardenPoolTarget } from "../PoolTarget";
import { CommitmentRecovery } from "./CommitmentRecovery";
import { CommitmentResolveDialog } from "./CommitmentResolveDialog";
import { CommitmentSettlementSection, showsSettlement } from "./CommitmentSettlement";
import { CommitmentSummary } from "./CommitmentSummary";
import { CommitmentTimeline } from "./CommitmentTimeline";
import { ConfirmKeptDialog } from "./ConfirmKeptDialog";
import {
  type OpenDialog,
  parseCommitmentRouteId,
  stageIndex,
} from "./commitmentDialogPresentation";

export interface CommitmentDialogPanelProps {
  chainId: number;
  /** The pool's garden: the authority a garden fallback uses. */
  garden: Address;
  commitmentId: string;
  tone: "garden" | "hub" | "community";
  /**
   * Open the seeding wizard on this commitment's answers. Only a surface that
   * has a seeding wizard passes it, and only the pool's stewards are offered it.
   */
  onSeedAnother?: (commitmentId: string) => void;
  /** Open at the waiting list, as a Waiting for approval row does (PRD-1025 D4). */
  focus?: "waiting";
}

/**
 * W10, one commitment in the steward's dialect (uiux-spec §6.7, follow-up
 * item 2: sectioned anatomy). Rendered inside the Garden workspace's left
 * inspector or the Hub's Confirm stage; every act goes through the shared
 * controller, every reasoned act through AdminReasonDialog, and a fallback
 * confirmation appears only when the ordinary path is unreachable, naming
 * the garden whose authority it uses.
 */
export function CommitmentDialogPanel({ commitmentId, ...props }: CommitmentDialogPanelProps) {
  const parsed = parseCommitmentRouteId(commitmentId);
  if (parsed === null) {
    return <CommitmentDialogNotFound garden={props.garden} onRetry={() => undefined} />;
  }
  // Keyed on the record: switching commitments inside one inspector must not
  // carry a resolution, a picked assessment or an open subdialog across.
  return <CommitmentRecord key={commitmentId} commitmentId={parsed} {...props} />;
}

function CommitmentRecord({
  chainId,
  garden,
  commitmentId,
  tone,
  onSeedAnother,
  focus,
}: Omit<CommitmentDialogPanelProps, "commitmentId"> & { commitmentId: bigint }) {
  const { formatMessage } = useIntl();
  const dialog = useCommitmentDialogController({ chainId, garden, commitmentId });
  const [open, setOpen] = useState<OpenDialog>(null);
  const [resolution, setResolution] = useState<DisputeResolutionKey>("RESTORE_PREVIOUS");
  const [assessmentUID, setAssessmentUID] = useState<string | null>(null);
  const [editingReward, setEditingReward] = useState(false);
  const waitingRef = useRef<HTMLDivElement>(null);
  const loaded = Boolean(dialog.commitment);
  // Opened from an ask: bring its waiting list into view once the record is read.
  useEffect(() => {
    if (focus === "waiting" && loaded) waitingRef.current?.scrollIntoView({ block: "start" });
  }, [focus, loaded]);
  const offlineNote = formatMessage({
    id: "cockpit.garden.pool.offline",
    defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
  });

  if (dialog.unavailable) {
    return <CommitmentDialogUnavailable garden={garden} />;
  }

  if (dialog.isLoading) {
    return <CommitmentDialogLoading />;
  }

  if (dialog.isError || dialog.notFound || !dialog.commitment) {
    return <CommitmentDialogNotFound garden={garden} onRetry={() => void dialog.refetch()} />;
  }

  const { commitment, detail, can, acts, confirmation } = dialog;
  const title =
    dialog.title ??
    formatMessage(
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Commitment {id}" },
      { id: commitment.commitmentId.toString() }
    );
  const actDisabled = !dialog.isOnline || dialog.isActing;
  // Every dialog below names the commitment and its garden's pool first: the
  // inspector also opens from the Hub and the protocol list, where the header
  // cannot say which garden a write lands in.
  const target = <GardenPoolTarget chainId={chainId} garden={garden} record={title} />;
  const stage = stageIndex(commitment.onchainState, commitment.evidenceCount);
  const asks = detail?.claimRequests ?? [];
  // A promise in a group changes its reward from the group; one on its own, here,
  // while nobody has taken it (the chain locks a reward at take-up).
  const rewardWei = commitment.considerationAmount ?? 0n;
  const canEditReward =
    dialog.isLocalSteward &&
    !dialog.metadata?.displayGroup &&
    (commitment.onchainState === "OFFERED" || commitment.onchainState === "REQUESTED") &&
    commitment.considerationRail === "CELO_SETTLEMENT" &&
    rewardWei > 0n;
  const fallbackPath =
    confirmation.allowed && confirmation.path !== "ORDINARY" ? confirmation.path : null;
  const evidenceOnly =
    (detail?.requirements.length ?? 0) === 0 && commitment.commitmentType !== "DOMAIN_IMPACT";
  const blockedReason = dialog.isOnline ? undefined : offlineNote;
  const closeDialog = () => setOpen(null);

  return (
    <div
      className="space-y-5 p-4"
      data-component="CommitmentDialogPanel"
      data-state={commitment.onchainState.toLowerCase()}
    >
      <CommitmentSummary
        commitment={commitment}
        title={title}
        note={dialog.note}
        isDue={dialog.isDue}
        fallbackPath={fallbackPath}
        stage={stage}
      />

      <CommitmentAlerts
        onchainState={commitment.onchainState}
        disputeReason={dialog.disputeReason}
        cancelReason={dialog.cancelReason}
        fallbackPath={fallbackPath}
        poolPaused={dialog.poolPaused}
      />

      <CommitmentFacts commitment={commitment} detail={detail} />

      {showsSettlement(commitment) ? (
        <CommitmentSettlementSection
          chainId={chainId}
          commitment={commitment}
          detail={detail}
          tone={tone}
          target={target}
        />
      ) : null}

      {dialog.isLocalSteward &&
      (commitment.onchainState === "ACCEPTED" ||
        dialog.reconciliation.readbackStatus !== "idle") ? (
        <CommitmentRecovery
          evidenceOnly={evidenceOnly}
          can={can}
          actDisabled={actDisabled}
          blockedReason={blockedReason}
          showAcceptedActs={commitment.onchainState === "ACCEPTED"}
          reconciliation={dialog.reconciliation}
          onOpenDialog={setOpen}
        />
      ) : null}

      {asks.length > 0 ? (
        <div ref={waitingRef} className="scroll-mt-4">
          <CommitmentClaims
            claims={asks}
            direction={commitment.direction}
            chainId={chainId}
            can={can}
            acts={acts}
            phaseFor={dialog.claimPhase}
            decisions={dialog.claimDecisions}
            standingOf={dialog.claimantStanding}
            actDisabled={actDisabled || dialog.claimInFlight}
            onOpenDialog={setOpen}
          />
        </div>
      ) : null}

      {(detail?.contributors.length ?? 0) > 0 ? (
        <CommitmentRoster contributors={detail!.contributors} />
      ) : null}

      <CommitmentTimeline events={dialog.events} />

      <CommitmentActions
        isOnline={dialog.isOnline}
        offlineNote={offlineNote}
        can={can}
        acts={acts}
        actDisabled={actDisabled}
        isActing={dialog.isActing}
        fallbackPath={fallbackPath}
        onOpenDialog={setOpen}
        sendPhase={dialog.sendPhase}
        chainId={chainId}
        onSeedAnother={
          onSeedAnother && dialog.isLocalSteward
            ? () => onSeedAnother(commitment.commitmentId.toString())
            : undefined
        }
        onEditReward={canEditReward ? () => setEditingReward(true) : undefined}
      />
      {canEditReward && editingReward ? (
        <PromiseRewardEdit
          onClose={() => setEditingReward(false)}
          chainId={chainId}
          garden={garden}
          title={title}
          commitmentId={commitment.commitmentId}
          currentWei={rewardWei}
          currentCentsAsSet={rewardCentsAsSet(dialog.metadata, rewardWei)}
        />
      ) : null}

      <CommitmentReasonDialogs
        open={open}
        onClose={closeDialog}
        tone={tone}
        acts={acts}
        blockedReason={blockedReason}
        target={target}
      />
      <CommitmentExpireDialog
        isOpen={open === "expire"}
        onClose={closeDialog}
        tone={tone}
        title={title}
        target={target}
        isLoading={dialog.isActing}
        onConfirm={async () => {
          await acts.expire();
          closeDialog();
        }}
      />
      <ConfirmKeptDialog
        open={open === "confirm-kept"}
        onClose={closeDialog}
        onConfirm={() => acts.confirmOrdinary()}
        tone={tone}
        chainId={chainId}
        poolGarden={garden}
        title={title}
        keptBy={commitment.leadProvider ?? commitment.creator ?? null}
        confirmationCount={commitment.confirmationCount ?? 0}
        confirmationThreshold={commitment.confirmationThreshold ?? 1}
        isLoading={dialog.isActing}
      />
      <CommitmentResolveDialog
        open={open}
        onClose={closeDialog}
        tone={tone}
        can={can}
        acts={acts}
        resolution={resolution}
        onResolutionChange={setResolution}
        blockedReason={blockedReason}
        target={target}
      />
      <CommitmentFallbackDialog
        open={open}
        onClose={closeDialog}
        tone={tone}
        acts={acts}
        blockedReason={blockedReason}
        fallbackPath={fallbackPath}
        target={target}
      />
      <CommitmentDeclineClaimDialog
        open={open}
        onClose={closeDialog}
        tone={tone}
        acts={acts}
        blockedReason={blockedReason}
        chainId={chainId}
        garden={garden}
        record={title}
      />
      <CommitmentAssessmentDialog
        open={open}
        onClose={closeDialog}
        tone={tone}
        acts={acts}
        assessments={dialog.assessments}
        assessmentsLoading={dialog.assessmentsLoading}
        assessmentUID={assessmentUID}
        onAssessmentUIDChange={setAssessmentUID}
        actDisabled={actDisabled}
        isActing={dialog.isActing}
        target={target}
      />
      <AdminConfirmDialog
        isOpen={open === "reconcile-work"}
        onClose={closeDialog}
        tone={tone}
        target={target}
        variant="warning"
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.reconciliation.title",
          defaultMessage: "Count Approved Linked Work",
        })}
        description={`${formatMessage(
          {
            id: "cockpit.garden.pool.commitment.reconciliation.body",
            defaultMessage:
              "{count, plural, one {# approved link is} other {# approved links are}} waiting to count.",
          },
          { count: dialog.reconciliation.count }
        )} ${formatMessage({
          id: "cockpit.garden.pool.commitment.reconciliation.warning",
          defaultMessage:
            "Counting work can make the commitment ready for confirmation and freeze its contributor roster.",
        })}`}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.reconciliation.confirm",
          defaultMessage: "Count Linked Work",
        })}
        cancelLabel={formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        isLoading={dialog.isActing}
        onError={() =>
          toastService.error({
            title: formatMessage({
              id: "cockpit.garden.pool.commitment.reconciliation.unavailable",
              defaultMessage: "Work decision readback is unavailable.",
            }),
            message: formatMessage({ id: "app.error.garden.tryAgain" }),
          })
        }
        onConfirm={async () => {
          await acts.syncWorkDecisions();
          closeDialog();
        }}
      />
    </div>
  );
}

/** Edit Reward on one promise, reading its garden's settlement account only while it is open. */
function PromiseRewardEdit({
  onClose,
  chainId,
  garden,
  title,
  commitmentId,
  currentWei,
  currentCentsAsSet,
}: {
  onClose: () => void;
  chainId: number;
  garden: Address;
  title: string;
  commitmentId: bigint;
  currentWei: bigint;
  currentCentsAsSet: bigint | null;
}) {
  const settlement = useSettlementAccount({ chainId, garden });
  return (
    <EditRewardDialog
      open
      onClose={onClose}
      onChanged={onClose}
      chainId={chainId}
      garden={garden}
      title={title}
      available={[commitmentId]}
      takenBy={[]}
      currentWei={currentWei}
      currentCentsAsSet={currentCentsAsSet}
      settlementActive={Boolean(settlement.detail?.account?.active)}
    />
  );
}
