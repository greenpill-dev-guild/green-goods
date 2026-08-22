import {
  type Address,
  Alert,
  DEFAULT_CHAIN_ID,
  isCommitmentReasonPinError,
  selectCommitmentSeat,
  useActions,
  useCommitment,
  useCommitmentClaimRequests,
  useCommitmentJobs,
  useCommitmentMetadataFor,
  useCommitmentMutation,
  useCommitmentPool,
  useCommitmentQueueState,
  useGardens,
  useHasRole,
  useOffline,
  usePrimaryAddress,
  useWorks,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import { type ClaimContext, ClaimContextSheet } from "./ClaimContextSheet";
import { CommitmentActionBar } from "./CommitmentActionBar";
import { canJoinTeam, selectCommitmentAct } from "./commitmentActions";
import { CommitmentClaimPanel } from "./CommitmentClaimPanel";
import { CommitmentDetailShell, CommitmentDetailState } from "./CommitmentDetailShell";
import { CommitmentIdentity } from "./CommitmentIdentity";
import { CommitmentProgress } from "./CommitmentProgress";
import { CommitmentTeam } from "./CommitmentTeam";
import { CommitmentWork } from "./CommitmentWork";
import { ConfirmSheet } from "./ConfirmSheet";
import { LinkWorkDialog } from "./LinkWorkDialog";
import { selectStatusBand } from "./statusBand";
import { WithdrawDialog } from "./WithdrawDialog";

/** ICommitmentPoolingModule.ClaimType: Garden = 0, Individual = 1. */
const CLAIM_TYPE_GARDEN = 0;
const CLAIM_TYPE_INDIVIDUAL = 1;

/**
 * One commitment, read by one person.
 *
 * Order is deliberate. Status sits above the identity, because a status message
 * read after the people and the progress bars is a status message nobody reads.
 * The act, when the reader has one, lives in a fixed bar rather than inside the
 * content, so the screen keeps the story and the bar owns the doing.
 */
export function GardenCommitment() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { commitmentId: commitmentIdParam, id: gardenAddress } = useParams<{
    commitmentId: string;
    id: string;
  }>();
  const { isOnline } = useOffline();
  const viewer = usePrimaryAddress();
  const chainId = DEFAULT_CHAIN_ID;

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [notYetFailed, setNotYetFailed] = useState(false);
  const [linkOpen, setLinkOpen] = useState<
    { workUID: string; requirementIndex: number } | true | null
  >(null);
  const commitmentId = useMemo(() => {
    if (!commitmentIdParam) return null;
    try {
      return BigInt(commitmentIdParam);
    } catch {
      return null;
    }
  }, [commitmentIdParam]);

  const { detail, isLoading, isError, refetch, availability } = useCommitment({
    chainId,
    commitmentId: commitmentId ?? 0n,
  });
  const jobs = useCommitmentJobs({ chainId });
  // Asked of the queue rather than remembered locally: a flag set when an act
  // is queued never hears that it landed, so the bar stayed suppressed for the
  // component's lifetime and survived navigation between commitments. All
  // three answers are read, because each changes what the bar may say: an act
  // already waiting, a send that gave up, and a queue the phone cannot read.
  const queue = useCommitmentQueueState(viewer as Address | null);
  const metadata = useCommitmentMetadataFor(detail?.commitment);
  const onlineMutation = useCommitmentMutation({ chainId });
  // The garden's work, online and queued, and its actions: what the Work
  // section reads and what the link picker chooses from.
  const { works } = useWorks(gardenAddress ?? "", { offline: true });
  // The pool decides whether a claim needs a provider-context choice: only a
  // protocol pool lets a steward take something up for their garden.
  const { pool } = useCommitmentPool(
    { chainId, poolId: detail?.commitment.poolId ?? 0n },
    { enabled: Boolean(detail?.commitment.poolId) }
  );
  const { hasRole: isOperator } = useHasRole(
    gardenAddress as Address | undefined,
    (viewer ?? undefined) as Address | undefined,
    "operator",
    chainId
  );
  const { hasRole: isOwner } = useHasRole(
    gardenAddress as Address | undefined,
    (viewer ?? undefined) as Address | undefined,
    "owner",
    chainId
  );
  const isSteward = isOperator || isOwner;
  const { data: gardens = [] } = useGardens();
  const gardenName =
    gardens.find((garden) => garden.id.toLowerCase() === gardenAddress?.toLowerCase())?.name ??
    null;
  // The reader's own claim request, in its exact lifecycle. Read whether the
  // commitment is still open or already taken: a declined or superseded
  // request still has something to say.
  const { claimRequests } = useCommitmentClaimRequests({
    chainId,
    commitmentId: commitmentId ?? 0n,
  });
  const ownRequest = useMemo(() => {
    if (!viewer) return null;
    const mine = claimRequests.filter(
      (request) =>
        request.requestedBy.toLowerCase() === viewer.toLowerCase() ||
        request.claimant.toLowerCase() === viewer.toLowerCase()
    );
    return mine.sort((left, right) => right.requestedAt - left.requestedAt)[0] ?? null;
  }, [claimRequests, viewer]);
  const { data: actions = [] } = useActions(chainId);

  const seat = useMemo(() => {
    if (!detail) return null;
    return selectCommitmentSeat({
      commitment: detail.commitment,
      contributors: detail.contributors.filter((c) => c.active).map((c) => c.contributor),
      viewer: (viewer ?? undefined) as Address | undefined,
    });
  }, [detail, viewer]);

  const back = () => navigate(-1);

  // Availability is answered before absence. While pooling is unavailable the
  // read is disabled, so there is no detail and no loading, and a not-found
  // branch tested first turns every deep link into "this does not exist".
  if (availability.status !== "available") {
    return <CommitmentDetailState kind="unavailable" onBack={back} />;
  }
  if (!commitmentId || (!isLoading && !detail && !isError)) {
    return <CommitmentDetailState kind="notFound" onBack={back} />;
  }
  if (isLoading) return <CommitmentDetailState kind="loading" onBack={back} />;
  if (isError || !detail) {
    return <CommitmentDetailState kind="error" onBack={back} onRetry={() => void refetch()} />;
  }

  const { commitment, contributors, requirements } = detail;
  const band = selectStatusBand({ commitment, seat });
  const queueKey = commitment.commitmentId.toString();
  const hasPendingJob = queue.pendingCommitmentIds.has(queueKey);
  const sendFailed = queue.failedCommitmentIds.has(queueKey);
  // A request still waiting on a steward is an act already taken: offering it
  // again would file a second request behind the same button.
  const hasPendingClaimRequest = ownRequest?.state === "PENDING";
  const act = selectCommitmentAct({
    commitment,
    seat,
    hasPendingJob: hasPendingJob || hasPendingClaimRequest,
  });
  const enqueueClaim = (context: ClaimContext) => {
    // A person claims as themselves; a steward may claim for their garden on
    // a protocol pool, which stores the garden as claimant and the steward as
    // the one who asked. The context is the garden the claim is scoped to,
    // never a person, and it is also the garden whose hat the queue waits for
    // before the first send. The choice is resolved here and never rewritten.
    void jobs
      .enqueue({
        act: "claim",
        payload: {
          commitmentId: commitment.commitmentId,
          kind: context === "garden" ? CLAIM_TYPE_GARDEN : CLAIM_TYPE_INDIVIDUAL,
          gardenContext: gardenAddress as Address,
          gardenAddress: gardenAddress as Address,
        },
      })
      .then(() => setContextOpen(false))
      .catch(() => {
        // useCommitmentJobs already surfaced it; the sheet stays where it is.
      });
  };
  const joinable = canJoinTeam({ commitment, seat });
  // Linking work is a provider's or contributor's act on garden work that is
  // still moving; it rides the bar's second row beside Add proof.
  const canLinkWork =
    commitment.commitmentType === "DOMAIN_IMPACT" &&
    (seat === "provider" || seat === "contributor") &&
    !commitment.contributorsFrozen &&
    (commitment.derivedState === "ACCEPTED" ||
      commitment.derivedState === "ACTIVE" ||
      commitment.derivedState === "PARTIALLY_APPROVED" ||
      commitment.derivedState === "EVIDENCE_SUBMITTED");
  const linkableWorks = works.filter(
    (work) =>
      viewer &&
      work.gardenerAddress.toLowerCase() === viewer.toLowerCase() &&
      (work.status === "approved" || work.status === "pending") &&
      !detail.workAttributions.some(
        (entry) => entry.linked && entry.workUID.toLowerCase() === work.id.toLowerCase()
      )
  );
  const linkWork = (workUID: string, requirementIndex: number) => {
    // A fresh operation id per act: a link after an unlink is a new operation,
    // and the queue derives the caller-scoped key from this id.
    void jobs
      .enqueue({
        act: "workLink",
        payload: {
          clientOperationId: crypto.randomUUID(),
          commitmentId: commitment.commitmentId,
          workUID: workUID as `0x${string}`,
          requirementIndex,
          gardenAddress: gardenAddress as Address,
        },
      })
      .then(() => setLinkOpen(null))
      .catch(() => {
        // useCommitmentJobs already surfaced it; the picker stays open.
      });
  };
  // The seat's act is real but the queue is unreadable, so it is held rather
  // than offered: a queue the phone cannot see may already hold this very act.
  // A terminal failure is the opposite case, and re-arms it on purpose: the
  // dead job no longer counts for dedupe, so trying again is a fresh send.
  const queueBlockedReasonId = queue.isUnavailable ? "app.commitments.queueUnreadable" : null;

  const units = commitment.unitLabel
    ? formatMessage(
        { id: "app.commitments.row.units" },
        { count: commitment.targetUnits.toString(), unit: commitment.unitLabel }
      )
    : null;
  // The member's own name for it leads; the units stay, because they are what
  // the commitment is measured and settled against.
  const heading = metadata?.title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });

  return (
    <>
      <CommitmentDetailShell
        onBack={back}
        title={heading}
        bar={
          act ? (
            <CommitmentActionBar
              act={act}
              isPending={jobs.isPending || onlineMutation.isPending}
              isOnline={isOnline}
              blockedReasonId={queueBlockedReasonId}
              secondary={
                canLinkWork && act.kind === "addProof"
                  ? { labelId: "app.commitment.act.linkWork", onRun: () => setLinkOpen(true) }
                  : null
              }
              onRun={() => {
                switch (act.kind) {
                  case "withdraw":
                    setWithdrawOpen(true);
                    return;
                  case "takeUp":
                  case "askToTakeUp":
                    // In a garden pool a member can only claim as themselves.
                    // In the protocol pool the provider context is a choice,
                    // made before any claim exists.
                    if (pool?.poolType === "PROTOCOL") setContextOpen(true);
                    else enqueueClaim("personal");
                    return;
                  case "sendForConfirmation":
                    void jobs.enqueue({
                      act: "sendForConfirmation",
                      commitmentId: commitment.commitmentId,
                      gardenAddress: gardenAddress as Address,
                    });
                    return;
                  case "confirm":
                    // The sheet asks the question and offers its two answers;
                    // the bar only opens it.
                    setConfirmOpen(true);
                    return;
                  case "addProof":
                    navigate("proof", { relative: "path" });
                    return;
                  case "offerAgain":
                    navigate("../..", { relative: "path" });
                }
              }}
            />
          ) : hasPendingJob ? (
            <p
              className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-text-sub-600"
              role="status"
            >
              {formatMessage({ id: "app.commitment.queue.waiting" })}
            </p>
          ) : null
        }
      >
        {sendFailed ? (
          <Alert variant="error" className="p-3">
            {formatMessage({ id: "app.commitment.queue.failed" })}
          </Alert>
        ) : null}

        <CommitmentIdentity
          commitment={commitment}
          contributors={contributors}
          seat={seat}
          band={band}
          metadata={metadata}
          units={units}
          joinable={joinable}
        />

        <CommitmentTeam
          commitment={commitment}
          contributors={contributors}
          requirements={requirements}
          actions={actions}
          chainId={chainId}
          seat={seat}
          viewer={viewer as Address | null}
          canJoin={joinable}
          isOnline={isOnline}
          isJoining={onlineMutation.isPending}
          onJoin={() =>
            // Joining is a contract call, not a queued job: the roster is
            // authoritative on chain and a join that waited offline could land
            // on a frozen team.
            onlineMutation.mutate({
              action: "joinCommitment",
              commitmentId: commitment.commitmentId,
            })
          }
        />

        {ownRequest && viewer ? (
          <CommitmentClaimPanel
            commitment={commitment}
            request={ownRequest}
            viewer={viewer as Address}
            canAskAgain={
              (commitment.derivedState === "OFFERED" || commitment.derivedState === "REQUESTED") &&
              !hasPendingJob &&
              !queue.isUnavailable
            }
            isPending={jobs.isPending}
            onAskAgain={() =>
              pool?.poolType === "PROTOCOL" ? setContextOpen(true) : enqueueClaim("personal")
            }
            onBackToBrowse={() => navigate("../..", { relative: "path" })}
          />
        ) : null}

        <CommitmentProgress chainId={chainId} commitment={commitment} requirements={requirements} />

        <CommitmentWork
          commitment={commitment}
          requirements={requirements}
          attributions={detail.workAttributions}
          works={works}
          actions={actions}
          chainId={chainId}
          viewer={viewer ?? null}
          canLink={canLinkWork && !hasPendingJob && !queue.isUnavailable}
          onOpenWork={(workUID) => navigate(`../../work/${workUID}`, { relative: "path" })}
          onLink={(workUID, requirementIndex) => setLinkOpen({ workUID, requirementIndex })}
        />
      </CommitmentDetailShell>

      <ClaimContextSheet
        open={contextOpen}
        onOpenChange={setContextOpen}
        gardenName={gardenName}
        canClaimForGarden={isSteward}
        approvalGated={commitment.claimMode === "APPROVAL_GATED"}
        isPending={jobs.isPending}
        onContinue={enqueueClaim}
      />

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        commitment={commitment}
        requirements={requirements}
        contributors={contributors}
        viewer={viewer as Address | null}
        isOnline={isOnline}
        // Where the sheet stands is read from the record and the queue, never
        // remembered: a kept commitment is the indexer's word, and a queued
        // confirmation is the queue's.
        phase={
          commitment.derivedState === "FULFILLED" || commitment.derivedState === "RECONCILED"
            ? "confirmed"
            : hasPendingJob
              ? "pending"
              : "ask"
        }
        isPending={jobs.isPending || onlineMutation.isPending}
        notYetFailed={notYetFailed}
        onConfirm={() => {
          void jobs.enqueue({
            act: "confirm",
            commitmentId: commitment.commitmentId,
            gardenAddress: gardenAddress as Address,
          });
        }}
        onNotYet={(reason) => {
          setNotYetFailed(false);
          onlineMutation.mutate(
            {
              action: "raiseDispute",
              commitmentId: commitment.commitmentId,
              reason,
              gardenAddress: gardenAddress as Address,
            },
            {
              onSuccess: () => setConfirmOpen(false),
              onError: () => setNotYetFailed(true),
            }
          );
        }}
        onDone={() => setConfirmOpen(false)}
      />

      <LinkWorkDialog
        open={linkOpen !== null}
        onOpenChange={(open) => {
          if (!open) setLinkOpen(null);
        }}
        works={linkableWorks}
        requirements={requirements}
        actions={actions}
        chainId={chainId}
        preselected={linkOpen && linkOpen !== true ? linkOpen : null}
        isPending={jobs.isPending}
        onConfirm={linkWork}
      />

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        direction={commitment.direction === "REQUEST" ? "REQUEST" : "OFFER"}
        isPending={onlineMutation.isPending}
        pinFailed={isCommitmentReasonPinError(onlineMutation.error)}
        onConfirm={(reason) => {
          // The words go to the hook, which pins them and sends the CID. The
          // dialog closes only once the chain has the call; a failed pin leaves
          // it open with the reason intact so the member can try again.
          onlineMutation.mutate(
            {
              action: "cancelCommitment",
              commitmentId: commitment.commitmentId,
              reason,
              gardenAddress: gardenAddress as Address,
            },
            { onSuccess: () => setWithdrawOpen(false) }
          );
        }}
      />
    </>
  );
}

export default GardenCommitment;
