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

import { selectPoolConsoleModel } from "../../../modules/commitment-pooling/pool-console";
import type { Address } from "../../../types/domain";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCommitmentCycleNames } from "../../commitment-pooling/useCommitmentCycleNames";
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
import { pinPoolCharter } from "../../../modules/commitment-pooling/pool-charter";

export function usePoolConsoleController(input: { chainId: number; garden: Address }) {
  const { chainId, garden } = input;
  const viewer = usePrimaryAddress() ?? undefined;
  const isOnline = useOnlineStatus();

  const poolsQuery = useCommitmentPools({ chainId, garden });
  const pool = poolsQuery.pools[0] ?? null;
  const poolId = pool?.poolId;
  const hasPool = poolId !== undefined;

  const cyclesQuery = useCommitmentCycles({ chainId, poolId: poolId ?? 0n }, { enabled: hasPool });
  const commitmentsQuery = useCommitments({ chainId, poolId }, { enabled: hasPool });
  const claimsQuery = usePoolClaimRequests(
    { chainId, poolId: poolId ?? 0n, state: "PENDING" },
    { enabled: hasPool }
  );
  const charter = usePoolCharter(pool?.charterCID);
  const pauseReason = useCommitmentReason(pool?.pauseReasonCID);
  const cycleNames = useCommitmentCycleNames(cyclesQuery.cycles);
  const metadata = useCommitmentMetadata(commitmentsQuery.commitments);
  const queue = useCommitmentQueueState(viewer);

  const now = useMemo(() => BigInt(Math.floor(Date.now() / 1000)), []);
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

  const requirePool = useCallback(() => {
    if (poolId === undefined) throw new Error("This garden has no commitment pool");
    return poolId;
  }, [poolId]);

  const acts = useMemo(
    () => ({
      pause: (reason: string) =>
        poolMutation.mutateAsync({
          action: "pausePool",
          poolId: requirePool(),
          reason,
          gardenAddress: garden,
        }),
      resume: () => poolMutation.mutateAsync({ action: "resumePool", poolId: requirePool() }),
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
        commitmentMutation.mutateAsync({ action: "acceptClaim", commitmentId, claimant }),
      declineClaim: (commitmentId: bigint, claimant: Address, reason: string) =>
        commitmentMutation.mutateAsync({
          action: "declineClaim",
          commitmentId,
          claimant,
          reason,
          gardenAddress: garden,
        }),
      /**
       * Edit pool settings: the charter sentence is pinned before
       * `setPoolCharter`; the cap goes straight to the register. Only what
       * changed is written, and the charter lands first so a cap failure
       * leaves the words recorded.
       */
      saveSettings: async (next: { purpose: string; cap: bigint }) => {
        const id = requirePool();
        const purposeChanged = next.purpose.trim() !== (charter.charter?.purpose ?? "");
        if (purposeChanged) {
          const charterCID = await pinPoolCharter({ purpose: next.purpose, gardenAddress: garden });
          await poolMutation.mutateAsync({ action: "setPoolCharter", poolId: id, charterCID });
        }
        if (next.cap !== (pool?.providerOpenCommitmentCap ?? 0n)) {
          await poolMutation.mutateAsync({
            action: "setProviderOpenCommitmentCap",
            poolId: id,
            cap: next.cap,
          });
        }
      },
    }),
    [poolMutation, commitmentMutation, requirePool, garden, charter.charter?.purpose, pool]
  );

  const refetch = useCallback(
    () =>
      Promise.all([
        poolsQuery.refetch(),
        cyclesQuery.refetch(),
        commitmentsQuery.refetch(),
        claimsQuery.refetch(),
      ]),
    [poolsQuery, cyclesQuery, commitmentsQuery, claimsQuery]
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
    titles: metadata.byCID,
    claims: claimsQuery.rows,
    charter,
    pauseReason,
    pendingCreates,
    queueUnavailable: queue.isUnavailable,
    acts,
    isActing: poolMutation.isPending || commitmentMutation.isPending,
    isLoading,
    isError,
    refetch,
  };
}

export type PoolConsoleController = ReturnType<typeof usePoolConsoleController>;
