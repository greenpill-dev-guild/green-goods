import { useServiceAccess } from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useGardenCommitmentController } from "@green-goods/shared/hooks/client-ui/commitment/useGardenCommitmentController";
import { useDashboardNavigation } from "@green-goods/shared/hooks/client-ui/useDashboardNavigation";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import type { Address } from "@green-goods/shared/types/domain";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import { mayStillLand } from "@green-goods/shared/utils/errors/tx-error-classifier";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { describeProofContents } from "@/components/Features/Commitments";
import { QueuedActNotice } from "@/components/Features/Commitments/QueuedActRow";
import type { ClaimContext } from "./ClaimContextSheet";
import { CommitmentActionBar } from "./CommitmentActionBar";
import { CommitmentClaims } from "./CommitmentClaims";
import { CommitmentDetailShell, CommitmentDetailState } from "./CommitmentDetailShell";
import { CommitmentEvidence } from "./CommitmentEvidence";
import { CommitmentHistory } from "./CommitmentHistory";
import { CommitmentIdentity } from "./CommitmentIdentity";
import { CommitmentPlace } from "./CommitmentPlace";
import { stewardsForPromiseGarden } from "./CommitmentPeople";
import { CommitmentProgress } from "./CommitmentProgress";
import { CommitmentTeam } from "./CommitmentTeam";
import { CommitmentWork } from "./CommitmentWork";
import { ConfirmSheet } from "./ConfirmSheet";
import { addProofReach, commitmentActForKind, takeUpMode } from "./commitmentActions";
import { parseCommitmentId, savedCommitmentForRoute, workSubmissionPath } from "./commitmentRoute";
import { FailedActAlert } from "./FailedActAlert";
import { JoinToAct, MembershipCheckFailed } from "./JoinToAct";
import { LinkWorkSheet } from "./LinkWorkSheet";
import { PromiseGroupNote } from "./PromiseGroupNote";
import { proofOnPhoneLine } from "./proofOnPhone";
import { SavedCommitment } from "./SavedCommitment";
import { ServicePromise } from "./ServicePromise";
import type { ServicePromiseParts } from "./servicePromiseTypes";
import { serviceReadOutcome } from "./serviceBooking";
import { selectStatusBand } from "./statusBand";
import { WithdrawSheet } from "./WithdrawSheet";
import { TakeUpReviewSheet } from "./TakeUpReviewSheet";

/** Errors are already surfaced by the shared mutation hooks; the view keeps its current surface. */
function keepSurfaceOnFailure(promise: Promise<unknown>): void {
  void promise.catch(() => undefined);
}

/** Closes a sheet once its act lands or may still land (PRD-1551); a failure keeps it open. */
function closeOnceSent(promise: Promise<unknown>, close: () => void, failed?: () => void): void {
  void promise.then(close, (error: unknown) => (mayStillLand(error) ? close() : failed?.()));
}

export function GardenCommitment() {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigate();
  const dashboardNavigation = useDashboardNavigation();
  const location = useLocation();
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
  const serviceKey = useMemo(
    () =>
      controller.viewer && commitmentId !== null
        ? {
            sourceChainId: controller.chainId,
            coreModule: getNetworkContracts(controller.chainId).commitmentPoolingModule,
            commitmentId,
            buyer: controller.viewer,
          }
        : null,
    [controller.viewer, controller.chainId, commitmentId]
  );
  const serviceAccess = useServiceAccess(serviceKey);
  const serviceRead = serviceReadOutcome(serviceAccess);
  // Member take-up follows consent; earned requests still need the stewards' ordinary decisions.
  const ordinary = serviceRead === "ordinary";
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<"kept" | "report" | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [takeUpReviewOpen, setTakeUpReviewOpen] = useState(false);
  useEffect(() => setTakeUpReviewOpen(false), [controller.viewer, commitmentId]);
  const [notYetFailed, setNotYetFailed] = useState(false);
  const [linkOpen, setLinkOpen] = useState<
    { workUID: string; requirementIndex: number | null } | true | null
  >(null);
  // Opened from Your Work, Back reopens it where it was, as a work's page does.
  const back = () => {
    if (dashboardNavigation.back()) return;
    if (location.state?.proofDirectEntry)
      return navigate("../..", { relative: "path", replace: true });
    navigate(-1);
  };

  const saved =
    !controller.isOnline && !controller.detail
      ? savedCommitmentForRoute(location.state, gardenAddress, commitmentId)
      : null;
  if (saved) return <SavedCommitment commitment={saved} onBack={back} />;

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
  if (!controller.detail) return <CommitmentDetailState kind="error" onBack={back} />;

  const detail = controller.detail;
  const { commitment, contributors, requirements } = detail;
  const requiredWorkApproved =
    requirements.length > 0 && requirements.every((row) => row.approvedCount >= row.requiredCount);
  const genericAct = commitmentActForKind(controller.actKind);
  const mode = takeUpMode(genericAct, controller.queue.pendingAct, commitment.claimMode);
  const selectedAct = !ordinary && mode ? null : genericAct;
  // A request's voucher reward is agreed to first, from its own bar, which then takes it up. A
  // claim that must first name its garden (the protocol pool) isn't offered there yet.
  const rewardTakeUp =
    mode && !controller.claimNeedsContext
      ? { mode, run: () => keepSurfaceOnFailure(controller.acts.claimPersonal()) }
      : null;
  // Linking the required work advances Garden Work promises; proof stays available.
  const workIsPrimary =
    selectedAct?.kind === "addProof" && controller.linkable && !requiredWorkApproved;
  const act = workIsPrimary
    ? { kind: "linkWork" as const, labelId: "app.commitment.act.linkWork" }
    : selectedAct;
  // Nonmembers see joining guidance instead of an act. Wait while membership
  // is being read or an act is already on its way.
  const untaken = commitment.derivedState === "OFFERED" || commitment.derivedState === "REQUESTED";
  const noActToOffer = ordinary && !act && !controller.queue.hasPendingJob && untaken;
  const showJoinToAct = noActToOffer && controller.membership.isMember === false;
  // A read the answer depends on failed: say so and offer it again, rather than
  // an empty bar or a join card for someone who may already belong.
  const showMembershipRetry = noActToOffer && controller.membership.unavailable;
  const band = selectStatusBand({
    commitment,
    seat: controller.seat,
    actKind: controller.actKind,
    hasLinkedWork: detail.workAttributions.some((row) => row.linked),
    requiredWorkApproved,
    pastDue: controller.pastDue,
    takeUpPending: controller.takeUpPending,
  });
  const isPending = controller.isQueueing || controller.isSending;
  const proofOnPhone = proofOnPhoneLine(controller.queue, formatMessage);
  const units = commitment.unitLabel
    ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
    : null;
  const heading =
    controller.metadata?.title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const stewards = stewardsForPromiseGarden(controller.pool?.garden, controller.roles.garden);
  const openWorkSubmission = (requirementIndex: number, actionUID: number | bigint) => {
    const path = workSubmissionPath({
      routeGarden: controller.routeGarden,
      workGarden: controller.workGarden,
      commitmentId: commitment.commitmentId,
      title: heading,
      requirementIndex,
      actionUID,
    });
    if (!path) return;
    setLinkOpen(null);
    dashboardNavigation.forward(path);
  };

  const claim = (context: ClaimContext) =>
    closeOnceSent(controller.acts.claim(context), () => setContextOpen(false));
  const runAct = () => {
    if (!act) return;
    switch (act.kind) {
      case "withdraw":
        setWithdrawOpen(true);
        return;
      case "takeUp":
      case "askToTakeUp":
        if (controller.claimNeedsContext) setContextOpen(true);
        else setTakeUpReviewOpen(true);
        return;
      case "sendForConfirmation":
        keepSurfaceOnFailure(controller.acts.sendForConfirmation());
        return;
      case "confirm":
        setConfirmOpen("kept");
        return;
      case "linkWork":
        setLinkOpen(true);
        return;
      case "addProof":
        dashboardNavigation.forward("proof", {
          relative: "path",
          state: { proofOrigin: location.pathname },
        });
        return;
      case "offerAgain":
      case "askAgain": {
        // Into the pool the commitment belongs to, which on the protocol pool is
        // not the garden this screen was opened from. Without that read there is
        // no honest destination: the route's garden would open a composer that
        // refuses this source as belonging to another pool.
        const poolGarden = controller.pool?.garden;
        if (!poolGarden) return;
        const door = act.kind === "askAgain" ? "request" : "offer";
        dashboardNavigation.forward(
          `/home/${poolGarden}/commitments/new?direction=${door}&from=${commitment.commitmentId.toString()}`
        );
      }
    }
  };
  const page = (service: ServicePromiseParts) => (
    <>
      <CommitmentDetailShell
        onBack={back}
        title={heading}
        tracker={service.tracker}
        subtitle={
          <CommitmentPlace
            chainId={controller.chainId}
            commitment={commitment}
            garden={controller.pool?.garden ?? (controller.routeGarden as Address | undefined)}
          />
        }
        bar={
          service.bar ??
          (act ? (
            <CommitmentActionBar
              act={act}
              isPending={isPending}
              isOnline={controller.isOnline}
              blockedReasonId={
                controller.queue.isUnavailable ? "app.commitments.queueUnreadable" : null
              }
              secondary={
                workIsPrimary
                  ? {
                      labelId: "app.commitment.act.addProof",
                      onRun: () =>
                        dashboardNavigation.forward("proof", {
                          relative: "path",
                          state: { proofOrigin: location.pathname },
                        }),
                    }
                  : null
              }
              onRun={runAct}
            />
          ) : controller.queue.hasPendingJob && !controller.queue.pendingAct ? (
            <p
              className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,var(--safe-area-bottom))] text-sm text-text-sub-600"
              role="status"
            >
              {formatMessage({ id: "app.commitment.queue.waiting" })}
            </p>
          ) : null)
        }
      >
        {controller.queue.proofSending ? null : controller.queue.sendFailed ? (
          <FailedActAlert
            failed={controller.queue.failedJob}
            onChanged={controller.queue.refresh}
          />
        ) : controller.queue.pendingAct ? (
          <QueuedActNotice
            key={controller.queue.pendingAct.jobId}
            act={controller.queue.pendingAct}
            inFlight={isPending}
            sendsFromTap={controller.queue.sendsFromTap}
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
          viewer={controller.viewer}
          stewards={stewards}
          {...service.identity}
        />
        {service.body}
        <PromiseGroupNote
          chainId={controller.chainId}
          commitment={commitment}
          metadata={controller.metadata}
          viewer={controller.viewer}
        />
        {showJoinToAct ? (
          <JoinToAct garden={controller.membership.garden} isOnline={controller.isOnline} />
        ) : null}
        {showMembershipRetry ? (
          <MembershipCheckFailed onRetry={controller.membership.retry} />
        ) : null}
        {serviceRead === "failed" ? (
          <MembershipCheckFailed check="service" onRetry={() => void serviceAccess.refetch()} />
        ) : null}
        {/* A booking has no team or History; until the read says it isn't one, hold them back. */}
        {service.booking || serviceRead === "unresolved" ? null : (
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
        )}
        {!service.booking &&
        (ordinary || serviceAccess.data?.acceptancePolicy.kind === "earned") ? (
          <CommitmentClaims
            commitment={commitment}
            acceptancePolicy={serviceAccess.data?.acceptancePolicy}
            viewer={controller.viewer}
            ownRequest={controller.ownRequest}
            pendingRequests={controller.pendingClaimRequests}
            canAskAgain={ordinary && controller.canAskAgain}
            stewardsPoolGarden={controller.roles.stewardsPoolGarden}
            claimGardens={controller.roles.claimGardens}
            contextOpen={ordinary && contextOpen}
            onContextOpenChange={setContextOpen}
            isClaiming={controller.isQueueing}
            isDeciding={controller.isSending}
            onAskAgain={() => {
              if (controller.claimNeedsContext) setContextOpen(true);
              else setTakeUpReviewOpen(true);
            }}
            onContinue={claim}
            onBackToBrowse={() => navigate("../..", { relative: "path" })}
            onAccept={(claimant) => keepSurfaceOnFailure(controller.acts.acceptClaim(claimant))}
            onDecline={(claimant, reason) =>
              keepSurfaceOnFailure(controller.acts.declineClaim(claimant, reason))
            }
          />
        ) : null}
        <CommitmentProgress
          chainId={controller.chainId}
          commitment={commitment}
          requirements={requirements}
          delivery={service.delivery}
          addProof={addProofReach(
            // The bar's own act, or the one beside required work; a service's own bar has neither.
            service.bar ? null : selectedAct,
            controller.seat,
            controller.takeUpOpen
          )}
          onPhone={
            controller.queue.proofOnItsWay
              ? {
                  kind: "sending",
                  summary:
                    describeProofContents(intl, controller.queue.proofOnItsWay, {
                      words: "alone",
                    }) ?? "",
                }
              : proofOnPhone
                ? { kind: "local" }
                : null
          }
        >
          <CommitmentEvidence
            attributions={detail.evidenceAttributions}
            recordedCount={commitment.evidenceCount}
          />
        </CommitmentProgress>
        <CommitmentWork
          commitment={commitment}
          requirements={requirements}
          attributions={detail.workAttributions}
          visibility={controller.workVisibility}
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
          onOpenWork={(workUID) =>
            dashboardNavigation.forward(`../../work/${workUID}`, { relative: "path" })
          }
          onLink={(workUID, requirementIndex) => setLinkOpen({ workUID, requirementIndex })}
        />
        {service.booking || serviceRead === "unresolved" ? null : (
          <CommitmentHistory
            chainId={controller.chainId}
            commitment={commitment}
            viewer={controller.viewer}
            localLine={proofOnPhone}
          />
        )}
      </CommitmentDetailShell>
      <TakeUpReviewSheet
        open={ordinary && takeUpReviewOpen}
        onOpenChange={setTakeUpReviewOpen}
        controller={controller}
        identity={{ commitment, contributors, band, units, stewards }}
        heading={heading}
        canConfirm={Boolean(mode || controller.canAskAgain)}
      />
      <ConfirmSheet
        open={confirmOpen !== null}
        onOpenChange={(open) => !open && setConfirmOpen(null)}
        startInNotYet={confirmOpen === "report"}
        service={service.confirm}
        commitment={commitment}
        requirements={requirements}
        contributors={contributors}
        evidenceAttributions={detail.evidenceAttributions}
        viewer={controller.viewer}
        isOnline={controller.isOnline}
        phase={controller.confirmation.phase}
        isPending={isPending}
        notYetFailed={notYetFailed}
        canNotYet={controller.confirmation.canNotYet}
        canConfirm={act?.kind === "confirm"}
        onConfirm={() => keepSurfaceOnFailure(controller.acts.confirm())}
        onNotYet={(reason) => {
          setNotYetFailed(false);
          closeOnceSent(
            controller.acts.notYet(reason),
            () => setConfirmOpen(null),
            () => setNotYetFailed(true)
          );
        }}
        onDone={() => setConfirmOpen(null)}
      />
      <LinkWorkSheet
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
        onConfirm={(workUID, requirementIndex, clientOperationId) =>
          closeOnceSent(
            controller.acts.linkWork(workUID, requirementIndex, clientOperationId),
            () => setLinkOpen(null)
          )
        }
      />
      {service.sheets}
      <WithdrawSheet
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        direction={commitment.direction === "REQUEST" ? "REQUEST" : "OFFER"}
        isPending={controller.isSending}
        pinFailed={controller.pinFailed}
        onConfirm={(reason) =>
          closeOnceSent(controller.acts.withdraw(reason), () => setWithdrawOpen(false))
        }
      />
    </>
  );

  return (
    <ServicePromise
      serviceKey={serviceKey}
      access={serviceAccess}
      commitment={commitment}
      gardenName={controller.roles.garden?.name ?? ""}
      heading={heading}
      note={controller.metadata?.note ?? null}
      hasCoreAct={Boolean(act)}
      isOnline={controller.isOnline}
      onReport={controller.confirmation.canNotYet ? () => setConfirmOpen("report") : null}
      takeUp={rewardTakeUp}
    >
      {page}
    </ServicePromise>
  );
}

export default GardenCommitment;
