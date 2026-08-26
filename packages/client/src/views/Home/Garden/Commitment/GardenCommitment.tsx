import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { writeWorkLinkIntent } from "@green-goods/shared/commitment-pooling";
import { useGardenCommitmentController } from "@green-goods/shared/hooks/client-ui/commitment/useGardenCommitmentController";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import type { ClaimContext } from "./ClaimContextSheet";
import { CommitmentActionBar } from "./CommitmentActionBar";
import { commitmentActForKind } from "./commitmentActions";
import { CommitmentClaims } from "./CommitmentClaims";
import { CommitmentDetailShell, CommitmentDetailState } from "./CommitmentDetailShell";
import { CommitmentIdentity } from "./CommitmentIdentity";
import { CommitmentProgress } from "./CommitmentProgress";
import { CommitmentTeam } from "./CommitmentTeam";
import { CommitmentWork } from "./CommitmentWork";
import { ConfirmSheet } from "./ConfirmSheet";
import { FailedActAlert } from "./FailedActAlert";
import { LinkWorkDialog } from "./LinkWorkDialog";
import { selectStatusBand } from "./statusBand";
import { WithdrawDialog } from "./WithdrawDialog";

function parseCommitmentId(value: string | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/** Errors are already surfaced by the shared mutation hooks; the view keeps its current surface. */
function keepSurfaceOnFailure(promise: Promise<unknown>): void {
  void promise.catch(() => undefined);
}

/** One commitment rendered from the shared reader, selector, queue, and mutation contract. */
export function GardenCommitment() {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigate();
  const { commitmentId: commitmentIdParam, id: gardenAddress } = useParams<{
    commitmentId: string;
    id: string;
  }>();
  const commitmentId = useMemo(() => parseCommitmentId(commitmentIdParam), [commitmentIdParam]);
  const controller = useGardenCommitmentController({
    chainId: DEFAULT_CHAIN_ID,
    commitmentId,
    routeGarden: gardenAddress,
  });
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [notYetFailed, setNotYetFailed] = useState(false);
  const [linkOpen, setLinkOpen] = useState<
    { workUID: string; requirementIndex: number | null } | true | null
  >(null);
  const back = () => navigate(-1);

  if (controller.status !== "ready") {
    if (controller.status === "error") {
      return (
        <CommitmentDetailState
          kind="error"
          onBack={back}
          onRetry={() => void controller.refetch()}
        />
      );
    }
    return <CommitmentDetailState kind={controller.status} onBack={back} />;
  }
  if (!controller.detail) {
    return <CommitmentDetailState kind="error" onBack={back} />;
  }

  const { commitment, contributors, requirements } = controller.detail;
  const act = commitmentActForKind(controller.actKind);
  const band = selectStatusBand({ commitment, seat: controller.seat });
  const isPending = controller.isQueueing || controller.isSending;
  const units = commitment.unitLabel
    ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
    : null;
  const heading =
    controller.metadata?.title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const openWorkSubmission = (requirementIndex: number, actionUID: number | bigint) => {
    const parsedActionUID = Number(actionUID);
    if (!controller.routeGarden || !controller.workGarden || !Number.isSafeInteger(parsedActionUID))
      return;
    const returnTo = `/home/${controller.routeGarden}/commitments/${commitment.commitmentId.toString()}`;
    const params = writeWorkLinkIntent(new URLSearchParams(), {
      commitmentId: commitment.commitmentId,
      requirementIndex,
      actionUID: parsedActionUID,
      garden: controller.workGarden,
      commitmentTitle: heading,
      requirementLabel: String(requirementIndex + 1),
      returnTo,
    });
    setLinkOpen(null);
    navigate(`/home/garden?${params.toString()}`);
  };

  const claim = (context: ClaimContext) => {
    void controller.acts
      .claim(context)
      .then(() => setContextOpen(false))
      .catch(() => undefined);
  };
  const runAct = () => {
    if (!act) return;
    switch (act.kind) {
      case "withdraw":
        setWithdrawOpen(true);
        return;
      case "takeUp":
      case "askToTakeUp":
        if (controller.claimNeedsContext) setContextOpen(true);
        else keepSurfaceOnFailure(controller.acts.claimPersonal());
        return;
      case "sendForConfirmation":
        keepSurfaceOnFailure(controller.acts.sendForConfirmation());
        return;
      case "confirm":
        setConfirmOpen(true);
        return;
      case "addProof":
        navigate("proof", { relative: "path" });
        return;
      case "offerAgain":
        navigate("../..", { relative: "path" });
    }
  };

  return (
    <>
      <CommitmentDetailShell
        onBack={back}
        title={heading}
        bar={
          act ? (
            <CommitmentActionBar
              act={act}
              isPending={isPending}
              isOnline={controller.isOnline}
              blockedReasonId={
                controller.queue.isUnavailable ? "app.commitments.queueUnreadable" : null
              }
              secondary={
                controller.linkable && act.kind === "addProof"
                  ? { labelId: "app.commitment.act.linkWork", onRun: () => setLinkOpen(true) }
                  : null
              }
              onRun={runAct}
            />
          ) : controller.queue.hasPendingJob ? (
            <p
              className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-text-sub-600"
              role="status"
            >
              {formatMessage({ id: "app.commitment.queue.waiting" })}
            </p>
          ) : null
        }
      >
        {controller.queue.sendFailed ? (
          <FailedActAlert
            failed={controller.queue.failedJob}
            onChanged={controller.queue.refresh}
          />
        ) : null}
        <CommitmentIdentity
          commitment={commitment}
          contributors={contributors}
          seat={controller.seat}
          band={band}
          metadata={controller.metadata}
          units={units}
          joinable={controller.joinable}
        />
        <CommitmentTeam
          commitment={commitment}
          contributors={contributors}
          requirements={requirements}
          actions={controller.actions}
          chainId={controller.chainId}
          seat={controller.seat}
          viewer={controller.viewer}
          canJoin={controller.joinable}
          isOnline={controller.isOnline}
          isJoining={controller.isSending}
          onJoin={() => keepSurfaceOnFailure(controller.acts.join())}
        />
        <CommitmentClaims
          commitment={commitment}
          viewer={controller.viewer}
          ownRequest={controller.ownRequest}
          pendingRequests={controller.pendingClaimRequests}
          canAskAgain={controller.canAskAgain}
          stewardsPoolGarden={controller.roles.stewardsPoolGarden}
          claimGardens={controller.roles.claimGardens}
          contextOpen={contextOpen}
          onContextOpenChange={setContextOpen}
          isClaiming={controller.isQueueing}
          isDeciding={controller.isSending}
          onAskAgain={() => {
            if (controller.claimNeedsContext) setContextOpen(true);
            else keepSurfaceOnFailure(controller.acts.claimPersonal());
          }}
          onContinue={claim}
          onBackToBrowse={() => navigate("../..", { relative: "path" })}
          onAccept={(claimant) => keepSurfaceOnFailure(controller.acts.acceptClaim(claimant))}
          onDecline={(claimant, reason) =>
            keepSurfaceOnFailure(controller.acts.declineClaim(claimant, reason))
          }
        />
        <CommitmentProgress
          chainId={controller.chainId}
          commitment={commitment}
          requirements={requirements}
        />
        <CommitmentWork
          commitment={commitment}
          requirements={requirements}
          attributions={controller.detail.workAttributions}
          workDecisions={controller.workDecisions}
          works={controller.works}
          actions={controller.actions}
          chainId={controller.chainId}
          viewer={controller.viewer}
          canLink={
            controller.linkable &&
            !controller.queue.hasPendingJob &&
            !controller.queue.isUnavailable
          }
          onOpenWork={(workUID) => navigate(`../../work/${workUID}`, { relative: "path" })}
          onLink={(workUID, requirementIndex) => setLinkOpen({ workUID, requirementIndex })}
        />
      </CommitmentDetailShell>

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        commitment={commitment}
        requirements={requirements}
        contributors={contributors}
        evidenceAttributions={controller.detail.evidenceAttributions}
        viewer={controller.viewer}
        isOnline={controller.isOnline}
        phase={controller.confirmation.phase}
        isPending={isPending}
        notYetFailed={notYetFailed}
        canNotYet={controller.confirmation.canNotYet}
        onConfirm={() => keepSurfaceOnFailure(controller.acts.confirm())}
        onNotYet={(reason) => {
          setNotYetFailed(false);
          void controller.acts
            .notYet(reason)
            .then(() => setConfirmOpen(false))
            .catch(() => setNotYetFailed(true));
        }}
        onDone={() => setConfirmOpen(false)}
      />
      <LinkWorkDialog
        open={linkOpen !== null}
        onOpenChange={(open) => !open && setLinkOpen(null)}
        works={controller.linkableWorks}
        requirements={requirements}
        actions={controller.actions}
        chainId={controller.chainId}
        preselected={linkOpen && linkOpen !== true ? linkOpen : null}
        isPending={controller.isQueueing}
        onSubmitRequirement={(requirement) =>
          openWorkSubmission(requirement.requirementIndex, requirement.actionUID)
        }
        onConfirm={(workUID, requirementIndex, clientOperationId) => {
          void controller.acts
            .linkWork(workUID, requirementIndex, clientOperationId)
            .then(() => setLinkOpen(null))
            .catch(() => undefined);
        }}
      />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        direction={commitment.direction === "REQUEST" ? "REQUEST" : "OFFER"}
        isPending={controller.isSending}
        pinFailed={controller.pinFailed}
        onConfirm={(reason) => {
          void controller.acts
            .withdraw(reason)
            .then(() => setWithdrawOpen(false))
            .catch(() => undefined);
        }}
      />
    </>
  );
}

export default GardenCommitment;
