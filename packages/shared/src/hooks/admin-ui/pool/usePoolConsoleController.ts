/**
 * usePoolConsoleController Hook
 *
 * Everything the steward's pool console (W7, uiux-spec §6.2) reads and does,
 * gathered once so the admin view is composition only: the garden's pool,
 * its cycles and their names, its commitments and their titles, the pending
 * claims, the charter sentence, the pause reason, the creations still queued
 * on this device, and the acts the console offers.
 *
 * Pool, cycle, claim and expiry acts are online mutations; `isOnline` lets
 * the view say so instead of queueing something the queue does not carry.
 *
 * @module hooks/admin-ui/pool/usePoolConsoleController
 */

import { useCallback, useMemo } from "react";
import type { PoolConsoleController } from "./controller.types";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import { commitmentNeedsSeat } from "../../../modules/commitment-pooling/acts";
import { selectPoolConsoleModel } from "../../../modules/commitment-pooling/pool-console";
import { selectCommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import {
  actPhaseFor,
  claimActKey,
  RESUME_POOL_ACT_KEY,
} from "../../../modules/transactions/act-phase";
import type { Address } from "../../../types/domain";
import { createMutationErrorHandler } from "../../../utils/errors/mutation-error-handler";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { useCommitmentCycleNames } from "../../commitment-pooling/useCommitmentCycleNames";
import {
  retryQueuedCommitmentJob,
  toActPhaseReport,
} from "../../commitment-pooling/useCommitmentJobs";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitmentMutation } from "../../commitment-pooling/useCommitmentMutations";
import {
  useCommitmentCycles,
  useCommitmentPools,
  useCommitments,
} from "../../commitment-pooling/useCommitmentPooling";
import { useCommitmentPoolMutation } from "../../commitment-pooling/useCommitmentPoolMutations";
import { useCommitmentQueueState } from "../../commitment-pooling/useCommitmentQueueState";
import { useCommitmentReason } from "../../commitment-pooling/useCommitmentReason";
import { usePoolCharter } from "../../commitment-pooling/usePoolCharter";
import { usePoolClaimRequests } from "../../commitment-pooling/usePoolClaimRequests";
import { usePoolFunding } from "../../commitment-pooling/usePoolFunding";
import { useExpiryClock } from "../../commitment-pooling/useExpiryClock";
import { useTxActPhase } from "../../blockchain/useTxActPhase";
import { useClaimDecisions, useClaimDecisionVisit } from "./useClaimDecisions";
import { useFinishCreating } from "./useFinishCreating";

/** Queue acts are not mutations, so their failures go through the same handler by hand. */
const reportQueuedSendError = createMutationErrorHandler({
  source: "usePoolConsoleController",
  toastContext: "commitment",
});

export function usePoolConsoleController(input: {
  chainId: number;
  garden: Address;
  /**
   * The Pool tab begins a visit; a flow opened over it (Seed Promises) joins
   * the tab's visit, so its own mount leaves the tab's outcomes in place.
   */
  visit?: "begin" | "join";
}): PoolConsoleController {
  const { chainId, garden, visit = "begin" } = input;
  const viewer = usePrimaryAddress() ?? undefined;
  const isOnline = useOnlineStatus();

  const poolsQuery = useCommitmentPools({ chainId, garden }, { refreshWhileOpen: true });
  // .at(0) keeps the null honest in the type; [0] would claim a pool always exists.
  const pool = poolsQuery.pools.at(0) ?? null;
  const poolId = pool?.poolId;
  const hasPool = poolId !== undefined;

  const cyclesQuery = useCommitmentCycles(
    { chainId, poolId: poolId ?? 0n },
    { enabled: hasPool, refreshWhileOpen: true }
  );
  const commitmentsQuery = useCommitments(
    { chainId, poolId },
    { enabled: hasPool, refreshWhileOpen: true }
  );
  const claimsQuery = usePoolClaimRequests(
    { chainId, poolId: poolId ?? 0n, state: "PENDING" },
    { enabled: hasPool, refreshWhileOpen: true }
  );
  const charter = usePoolCharter(pool?.charterCID);
  const pauseReason = useCommitmentReason(pool?.pauseReasonCID);
  const cycleNames = useCommitmentCycleNames(cyclesQuery.cycles);
  const metadata = useCommitmentMetadata(commitmentsQuery.commitments);
  const queue = useCommitmentQueueState(viewer);
  const funding = usePoolFunding({ chainId, garden });
  const fundingView = useMemo(
    () => ({
      snapshot: funding.snapshot,
      isLoading: funding.isLoading,
      isFetching: funding.isFetching,
      isRefetching: funding.isRefetching,
      isError: funding.isError,
      hasStaleBalance: funding.hasStaleBalance,
      lastReadAt: funding.lastReadAt,
      ledgerReadAt: funding.ledgerReadAt,
      refetch: funding.refetch,
    }),
    [
      funding.snapshot,
      funding.isLoading,
      funding.isFetching,
      funding.isRefetching,
      funding.isError,
      funding.hasStaleBalance,
      funding.lastReadAt,
      funding.ledgerReadAt,
      funding.refetch,
    ]
  );

  const cycleEndTimes = useMemo(
    () =>
      new Map(
        (hasPool ? cyclesQuery.cycles : []).map((row) => [row.cycleId.toString(), row.endTime])
      ),
    [hasPool, cyclesQuery.cycles]
  );
  const now = useExpiryClock({ commitments: commitmentsQuery.commitments, cycleEndTimes });
  const model = useMemo(
    () =>
      selectPoolConsoleModel({
        pool,
        cycles: hasPool ? cyclesQuery.cycles : [],
        commitments: commitmentsQuery.commitments,
        pendingClaimCount: claimsQuery.rows.length,
        now,
      }),
    [pool, hasPool, cyclesQuery.cycles, commitmentsQuery.commitments, claimsQuery.rows.length, now]
  );
  // "Needs you" (PRD-1022 a8): promises whose next act is this steward's own,
  // not an option they may take, by the seat and act rules the promise page and
  // the app's pool list use. A request the steward made sits here rather than in
  // the garden's Confirm queue, which leaves out what the reader is a party to.
  // The team isn't read at list scope, as in the app's pool list.
  const waitingOnYou = useMemo(() => {
    const ids = new Set<string>();
    if (!viewer) return ids;
    for (const commitment of commitmentsQuery.commitments) {
      const seat = selectCommitmentSeat({ commitment, contributors: [], viewer });
      if (commitmentNeedsSeat({ commitment, seat })) ids.add(commitment.id);
    }
    return ids;
  }, [commitmentsQuery.commitments, viewer]);

  const pendingCreates = useMemo(
    () =>
      poolId === undefined
        ? []
        : queue.pendingCreates.filter(
            (row) => row.chainId === chainId && row.poolId === poolId.toString()
          ),
    [queue.pendingCreates, poolId, chainId]
  );

  const poolMutation = useCommitmentPoolMutation({ chainId });
  const commitmentMutation = useCommitmentMutation({ chainId });
  // Approve is one signature from a list row: the row follows it to the chain,
  // on this card and in the inspector alike, and keeps its outcome this visit.
  useClaimDecisionVisit(chainId, garden, visit === "begin");
  const claimDecisions = useClaimDecisions();
  const { approve: approveClaim, decline: declineClaim } = claimDecisions;
  // Resume and a queued row's send are single signatures too: each says where
  // it stands on the card it started from.
  const poolAct = useTxActPhase();
  const trackPool = poolAct.track;
  const queuedAct = useTxActPhase();
  const trackQueued = queuedAct.trackReported;
  const sender = useTransactionSender();
  const refreshQueue = queue.refresh;
  // A group's copies that didn't send, and the one act that sends them (PRD-1022 D12).
  const finishing = useFinishCreating({ chainId, owner: viewer ?? null });
  const finishGroup = finishing.finish;

  const requirePool = useCallback(() => {
    if (poolId === undefined) throw new Error("This garden has no commitment pool");
    return poolId;
  }, [poolId]);

  // The ask a decision answers, so a later ask by the same person reads as new.
  const pendingAsks = claimsQuery.rows;
  const askedAt = useCallback(
    (commitmentId: bigint, claimant: Address) =>
      pendingAsks.find(
        (row) =>
          row.claim.commitmentId === commitmentId &&
          row.claim.claimant.toLowerCase() === claimant.toLowerCase()
      )?.claim.requestedAt,
    [pendingAsks]
  );
  const acts = useMemo(
    () => ({
      pause: (reason: string) =>
        poolMutation.mutateAsync({
          action: "pausePool",
          poolId: requirePool(),
          reason,
          gardenAddress: garden,
        }),
      resume: () => {
        // Refused before the line starts: an act with no pool never asks the wallet.
        const poolId = requirePool();
        return trackPool(RESUME_POOL_ACT_KEY, (send) =>
          poolMutation.mutateAsync({ action: "resumePool", poolId, send })
        );
      },
      closePool: () => poolMutation.mutateAsync({ action: "closePool", poolId: requirePool() }),
      compostPool: () => poolMutation.mutateAsync({ action: "compostPool", poolId: requirePool() }),
      reopenPool: (toOpen: boolean) =>
        poolMutation.mutateAsync({ action: "reopenPool", poolId: requirePool(), toOpen }),
      cancelCycle: (cycleId: bigint, reason: string) =>
        poolMutation.mutateAsync({ action: "cancelCycle", cycleId, reason, gardenAddress: garden }),
      closeCycle: (cycleId: bigint) => poolMutation.mutateAsync({ action: "closeCycle", cycleId }),
      compostCycle: (cycleId: bigint) =>
        poolMutation.mutateAsync({ action: "compostCycle", cycleId }),
      expire: (commitmentId: bigint) =>
        commitmentMutation.mutateAsync({ action: "expireCommitment", commitmentId }),
      acceptClaim: (commitmentId: bigint, claimant: Address) =>
        approveClaim(
          commitmentId,
          claimant,
          (send) =>
            commitmentMutation.mutateAsync({ action: "acceptClaim", commitmentId, claimant, send }),
          askedAt(commitmentId, claimant)
        ),
      declineClaim: (commitmentId: bigint, claimant: Address, reason: string) =>
        declineClaim(
          commitmentId,
          claimant,
          () =>
            commitmentMutation.mutateAsync({
              action: "declineClaim",
              commitmentId,
              claimant,
              reason,
              gardenAddress: garden,
            }),
          askedAt(commitmentId, claimant)
        ),
      // The admin mounts no queue provider, so nothing sends a queued creation
      // unless the steward does. The row is re-read either way: a failed retry
      // changes what it says.
      retryQueued: async (jobId: string) => {
        try {
          await trackQueued(jobId, (report) =>
            retryQueuedCommitmentJob(jobId, sender, toActPhaseReport(report))
          );
        } catch (error) {
          reportQueuedSendError(error, { gardenAddress: garden, metadata: { act: "retryQueued" } });
        } finally {
          refreshQueue();
        }
      },
      finishCreating: async (displayGroupId: string) => {
        try {
          return await finishGroup(displayGroupId);
        } catch (error) {
          reportQueuedSendError(error, {
            gardenAddress: garden,
            metadata: { act: "finishCreating" },
          });
          return "blocked" as const;
        }
      },
      // The queue refuses a row whose send may already be on chain, and a row on
      // screen can go stale. Say so rather than leaving it sitting there.
      discardQueued: async (jobId: string) => {
        try {
          const discarded = await jobQueue.discardJob(jobId);
          if (!discarded) throw new Error("This one may already have been sent, so it was kept.");
        } catch (error) {
          reportQueuedSendError(error, {
            gardenAddress: garden,
            metadata: { act: "discardQueued" },
          });
        } finally {
          refreshQueue();
        }
      },
    }),
    [
      poolMutation,
      commitmentMutation,
      approveClaim,
      declineClaim,
      askedAt,
      trackPool,
      trackQueued,
      finishGroup,
      requirePool,
      garden,
      sender,
      refreshQueue,
    ]
  );

  const refetch = useCallback(
    () =>
      Promise.all([
        poolsQuery.refetch(),
        cyclesQuery.refetch(),
        commitmentsQuery.refetch(),
        claimsQuery.refetch(),
        fundingView.refetch(),
      ]),
    [poolsQuery, cyclesQuery, commitmentsQuery, claimsQuery, fundingView]
  );

  const isLoading =
    poolsQuery.isLoading ||
    (hasPool && (cyclesQuery.isLoading || commitmentsQuery.isLoading || claimsQuery.isLoading));
  const isError =
    poolsQuery.isError ||
    (hasPool && (cyclesQuery.isError || commitmentsQuery.isError || claimsQuery.isError));

  return {
    chainId,
    garden,
    viewer,
    isOnline,
    availability: poolsQuery.availability,
    pool,
    poolId,
    model,
    cycles: hasPool ? cyclesQuery.cycles : [],
    cycleNames: cycleNames.byCycleId,
    commitments: commitmentsQuery.commitments,
    waitingOnYou,
    titles: metadata.byCID,
    claims: claimsQuery.rows,
    charter,
    pauseReason,
    pendingCreates,
    queuedGroupCopies: finishing.waiting,
    finishingGroupId: finishing.sendingGroupId,
    queueUnavailable: queue.isUnavailable,
    funding: fundingView,
    acts,
    claimPhase: (commitmentId: bigint, claimant: Address) =>
      actPhaseFor(claimDecisions.phase, claimActKey(commitmentId, claimant)),
    claimDecisions: claimDecisions.decisions,
    claimInFlight:
      claimDecisions.phase.status === "signing" || claimDecisions.phase.status === "confirming",
    resumePhase: actPhaseFor(poolAct.phase, RESUME_POOL_ACT_KEY),
    queuedPhase: (jobId: string) => actPhaseFor(queuedAct.phase, jobId),
    isActing: poolMutation.isPending || commitmentMutation.isPending,
    isLoading,
    isError,
    refetch,
  };
}
