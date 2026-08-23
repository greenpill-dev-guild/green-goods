import {
  type Address,
  type DisputeResolutionKey,
  useCommitmentDialogController,
} from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
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
import { CommitmentRecovery } from "./CommitmentRecovery";
import { CommitmentResolveDialog } from "./CommitmentResolveDialog";
import { CommitmentSummary } from "./CommitmentSummary";
import { CommitmentTimeline } from "./CommitmentTimeline";
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
}: Omit<CommitmentDialogPanelProps, "commitmentId"> & { commitmentId: bigint }) {
  const { formatMessage } = useIntl();
  const dialog = useCommitmentDialogController({ chainId, garden, commitmentId });
  const [open, setOpen] = useState<OpenDialog>(null);
  const [resolution, setResolution] = useState<DisputeResolutionKey>("RESTORE_PREVIOUS");
  const [assessmentUID, setAssessmentUID] = useState<string | null>(null);
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
  const stage = stageIndex(commitment.onchainState, commitment.evidenceCount);
  const pendingClaims = (detail?.claimRequests ?? []).filter((claim) => claim.state === "PENDING");
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

      {commitment.onchainState === "ACCEPTED" && dialog.isLocalSteward ? (
        <CommitmentRecovery
          evidenceOnly={evidenceOnly}
          can={can}
          actDisabled={actDisabled}
          onOpenDialog={setOpen}
        />
      ) : null}

      {pendingClaims.length > 0 ? (
        <CommitmentClaims
          claims={pendingClaims}
          can={can}
          acts={acts}
          actDisabled={actDisabled}
          onOpenDialog={setOpen}
        />
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
      />

      <CommitmentReasonDialogs
        open={open}
        onClose={closeDialog}
        tone={tone}
        acts={acts}
        blockedReason={blockedReason}
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
      />
      <CommitmentFallbackDialog
        open={open}
        onClose={closeDialog}
        tone={tone}
        acts={acts}
        blockedReason={blockedReason}
        fallbackPath={fallbackPath}
      />
      <CommitmentDeclineClaimDialog
        open={open}
        onClose={closeDialog}
        tone={tone}
        acts={acts}
        blockedReason={blockedReason}
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
      />
    </div>
  );
}
