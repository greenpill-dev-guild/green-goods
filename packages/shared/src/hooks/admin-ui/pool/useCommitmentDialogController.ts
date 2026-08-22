/**
 * useCommitmentDialogController Hook
 *
 * One commitment in the steward's dialect (W10, uiux-spec §6.7): the
 * record with its roster, claims, requirements and timeline, the reader's
 * authority over it, and the acts that authority and the record's state
 * allow. The admin dialog renders from this and never asks the chain or the
 * indexer itself.
 *
 * Eligibility follows the contract: ordinary confirmation through the
 * reader's seat; a garden fallback only while the ordinary path is
 * unreachable and the reader currently stewards the commitment's own garden;
 * a protocol fallback only when the commitment opted in and the reader
 * currently stewards the registered protocol garden; never for anyone on the
 * roster. Local authority is tested first, so a dual-role steward renders the
 * garden path.
 *
 * @module hooks/admin-ui/pool/useCommitmentDialogController
 */

import { useCallback, useMemo } from "react";

import { selectCommitmentActKind } from "../../../modules/commitment-pooling/acts";
import {
  isPoolSteward,
  selectCommitmentSeat,
  selectConfirmationEligibility,
  selectDueLiveCommitments,
  selectOrdinaryConfirmationReachable,
} from "../../../modules/commitment-pooling/selectors";
import type { Address } from "../../../types/domain";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { useGardenAssessments } from "../../assessment/useGardenAssessments";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import { useCommitmentMetadataFor } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitmentMutation } from "../../commitment-pooling/useCommitmentMutations";
import {
  useCommitment,
  useCommitmentActivity,
  useCommitmentCycle,
  useCommitmentPools,
} from "../../commitment-pooling/useCommitmentPooling";
import { useCommitmentQueueState } from "../../commitment-pooling/useCommitmentQueueState";
import { useCommitmentReason } from "../../commitment-pooling/useCommitmentReason";
import { useProtocolPool } from "../../commitment-pooling/useProtocolPool";
import { useGardenRoles } from "../../roles/useGardenRoles";

/** `ICommitmentPoolingModule.DisputeResolution`, by code. */
export const DISPUTE_RESOLUTION_CODE = {
  RESTORE_PREVIOUS: 0,
  FULFILLED: 1,
  CANCELLED: 2,
  EXPIRED: 3,
} as const;

export type DisputeResolutionKey = keyof typeof DISPUTE_RESOLUTION_CODE;

export function useCommitmentDialogController(input: {
  chainId: number;
  /** The pool's garden: the authority a garden fallback uses. */
  garden: Address;
  commitmentId: bigint;
}) {
  const { chainId, garden, commitmentId } = input;
  const viewer = usePrimaryAddress() ?? undefined;
  const isOnline = useOnlineStatus();

  const detailQuery = useCommitment({ chainId, commitmentId });
  const commitment = detailQuery.commitment;
  const detail = detailQuery.detail;
  const activity = useCommitmentActivity({ chainId, commitmentId, limit: 50 });
  const metadata = useCommitmentMetadataFor(commitment ?? undefined);
  const poolsQuery = useCommitmentPools({ chainId, garden });
  // .at(0) keeps the null honest in the type; [0] would claim a pool always exists.
  const pool = poolsQuery.pools.at(0) ?? null;
  const cycleQuery = useCommitmentCycle(
    { chainId, cycleId: commitment?.cycleId ?? 0n },
    { enabled: Boolean(commitment?.cycleId && commitment.cycleId !== 0n) }
  );
  const protocolPool = useProtocolPool({ chainId });
  const localRoles = useGardenRoles(garden, viewer, chainId);
  const protocolRoles = useGardenRoles(protocolPool.rootGarden, viewer, chainId);
  const disputeReason = useCommitmentReason(commitment?.disputeReasonCID);
  const cancelReason = useCommitmentReason(commitment?.cancelReasonCID);
  const assessments = useGardenAssessments(
    commitment?.requiresAssessment && commitment.providerGarden
      ? commitment.providerGarden
      : undefined,
    chainId
  );
  const queue = useCommitmentQueueState(viewer);
  const mutation = useCommitmentMutation({ chainId });
  const jobs = useCommitmentJobs({ chainId });

  const activeContributors = useMemo<Address[]>(
    () => (detail?.contributors ?? []).filter((row) => row.active).map((row) => row.contributor),
    [detail?.contributors]
  );
  const isLocalSteward = isPoolSteward(localRoles.roles);
  const isProtocolSteward = isPoolSteward(protocolRoles.roles);
  const onRoster = Boolean(
    viewer && activeContributors.some((address) => address.toLowerCase() === viewer.toLowerCase())
  );
  const poolPaused = pool?.state === "PAUSED";

  const seat = useMemo(
    () =>
      commitment
        ? selectCommitmentSeat({ commitment, contributors: activeContributors, viewer })
        : null,
    [commitment, activeContributors, viewer]
  );

  const ordinaryReachable = useMemo(
    () =>
      commitment
        ? selectOrdinaryConfirmationReachable({
            confirmers: commitment.confirmers,
            confirmationThreshold: commitment.confirmationThreshold ?? 0,
            direction: commitment.direction,
            counterpartyKind: commitment.counterpartyKind,
            creator: commitment.creator,
            counterparty: commitment.counterparty,
            activeContributors,
          })
        : false,
    [commitment, activeContributors]
  );

  const confirmation = useMemo(
    () =>
      commitment
        ? selectConfirmationEligibility({
            state: commitment.onchainState,
            viewer,
            contributors: activeContributors,
            alreadyConfirmed: false,
            ordinaryEligible:
              seat !== null && selectCommitmentActKind({ commitment, seat }) === "confirm",
            ordinaryReachable,
            localFallbackSteward: isLocalSteward,
            protocolFallbackSteward: isProtocolSteward,
            protocolFallbackEnabled: commitment.protocolFallbackEnabled === true,
          })
        : ({ allowed: false, path: null, reason: "unauthenticated" } as const),
    [
      commitment,
      viewer,
      activeContributors,
      seat,
      ordinaryReachable,
      isLocalSteward,
      isProtocolSteward,
    ]
  );

  const now = useMemo(() => BigInt(Math.floor(Date.now() / 1000)), []);
  const isDue = useMemo(() => {
    if (!commitment) return false;
    const cycleEndTimes = new Map<string, bigint | null>();
    if (cycleQuery.cycle) {
      cycleEndTimes.set(cycleQuery.cycle.cycleId.toString(), cycleQuery.cycle.endTime);
    }
    return selectDueLiveCommitments({ commitments: [commitment], cycleEndTimes, now }).length > 0;
  }, [commitment, cycleQuery.cycle, now]);

  const hasPendingJob = commitment
    ? queue.pendingCommitmentIds.has(commitment.commitmentId.toString())
    : false;

  /**
   * What this steward may do to this record, each a plain boolean derived
   * from state, authority and the contract's own gates, so a disabled
   * control never offers a call that would revert.
   */
  const can = useMemo(() => {
    if (!commitment || !viewer) {
      return {
        cancel: false,
        markReady: false,
        sendForConfirmation: false,
        attachAssessment: false,
        raiseDispute: false,
        resolveDispute: false,
        resolveFulfilled: false,
        expire: false,
        confirmOrdinary: false,
        confirmFallback: false,
        acceptClaim: false,
        declineClaim: false,
      };
    }
    const state = commitment.onchainState;
    const evidenceOnly =
      (detail?.requirements.length ?? 0) === 0 && commitment.commitmentType !== "DOMAIN_IMPACT";
    const steward = isLocalSteward;
    const accepted = state === "ACCEPTED";
    const disputable =
      state === "ACCEPTED" ||
      state === "READY_FOR_CONFIRMATION" ||
      state === "FULFILLED" ||
      state === "EXPIRED";
    const live = state === "ACCEPTED" || state === "READY_FOR_CONFIRMATION";
    return {
      cancel: steward && accepted && !poolPaused,
      markReady: steward && accepted && evidenceOnly && !poolPaused,
      sendForConfirmation:
        (steward || seat === "provider" || seat === "confirmer") &&
        accepted &&
        evidenceOnly &&
        commitment.evidenceCount > 0 &&
        !poolPaused &&
        !hasPendingJob,
      attachAssessment:
        steward &&
        accepted &&
        commitment.requiresAssessment === true &&
        !commitment.assessmentUID &&
        !commitment.contributorsFrozen,
      raiseDispute: (steward || seat === "provider" || seat === "confirmer") && disputable,
      resolveDispute: steward && state === "DISPUTED",
      // Fulfilled resolution is a confirmation: never by a contributor, never
      // for a record that had already expired.
      resolveFulfilled:
        steward && state === "DISPUTED" && !onRoster && commitment.preDisputeState !== "EXPIRED",
      expire: isDue && live,
      confirmOrdinary:
        confirmation.allowed && confirmation.path === "ORDINARY" && !poolPaused && !hasPendingJob,
      confirmFallback:
        confirmation.allowed &&
        (confirmation.path === "POOL_FALLBACK" || confirmation.path === "PROTOCOL_FALLBACK") &&
        !poolPaused,
      acceptClaim: steward && (state === "OFFERED" || state === "REQUESTED") && !poolPaused,
      declineClaim: steward && (state === "OFFERED" || state === "REQUESTED") && !poolPaused,
    };
  }, [
    commitment,
    viewer,
    detail?.requirements.length,
    isLocalSteward,
    poolPaused,
    seat,
    hasPendingJob,
    onRoster,
    isDue,
    confirmation,
  ]);

  const acts = useMemo(
    () => ({
      cancel: (reason: string) =>
        mutation.mutateAsync({
          action: "cancelCommitment",
          commitmentId,
          reason,
          gardenAddress: garden,
        }),
      markReady: (reason: string) =>
        mutation.mutateAsync({ action: "markReadyForConfirmation", commitmentId, reason }),
      sendForConfirmation: () =>
        jobs.enqueue({ act: "sendForConfirmation", commitmentId, gardenAddress: garden }),
      attachAssessment: (assessmentUID: `0x${string}`) =>
        mutation.mutateAsync({ action: "attachAssessment", commitmentId, assessmentUID }),
      raiseDispute: (reason: string) =>
        mutation.mutateAsync({
          action: "raiseDispute",
          commitmentId,
          reason,
          gardenAddress: garden,
        }),
      resolveDispute: (resolution: DisputeResolutionKey, reason: string) =>
        mutation.mutateAsync({
          action: "resolveDispute",
          commitmentId,
          resolution: DISPUTE_RESOLUTION_CODE[resolution],
          reason,
          gardenAddress: garden,
        }),
      expire: () => mutation.mutateAsync({ action: "expireCommitment", commitmentId }),
      confirmOrdinary: () => jobs.enqueue({ act: "confirm", commitmentId, gardenAddress: garden }),
      /** The reason goes on chain as plain text: the contract stores it itself. */
      confirmFallback: (reason: string) =>
        mutation.mutateAsync({ action: "confirmFulfillmentAsFallback", commitmentId, reason }),
      acceptClaim: (claimant: Address) =>
        mutation.mutateAsync({ action: "acceptClaim", commitmentId, claimant }),
      declineClaim: (claimant: Address, reason: string) =>
        mutation.mutateAsync({
          action: "declineClaim",
          commitmentId,
          claimant,
          reason,
          gardenAddress: garden,
        }),
    }),
    [mutation, jobs, commitmentId, garden]
  );

  const refetch = useCallback(
    () => Promise.all([detailQuery.refetch(), activity.refetch()]),
    [detailQuery, activity]
  );

  return {
    chainId,
    garden,
    viewer,
    isOnline,
    availability: detailQuery.availability,
    commitment,
    detail,
    title: metadata?.title ?? null,
    note: metadata?.note ?? null,
    cycle: cycleQuery.cycle,
    events: activity.events,
    disputeReason,
    cancelReason,
    assessments: assessments.data ?? [],
    assessmentsLoading: assessments.isLoading,
    activeContributors,
    seat,
    isLocalSteward,
    isProtocolSteward,
    onRoster,
    poolPaused,
    ordinaryReachable,
    confirmation,
    isDue,
    hasPendingJob,
    can,
    acts,
    isActing: mutation.isPending || jobs.isPending,
    isLoading: detailQuery.isLoading || activity.isLoading || poolsQuery.isLoading,
    isError: detailQuery.isError,
    notFound: !detailQuery.isLoading && !detailQuery.isError && commitment === null,
    refetch,
  };
}

export type CommitmentDialogController = ReturnType<typeof useCommitmentDialogController>;
