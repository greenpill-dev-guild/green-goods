import { useCallback, useMemo, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import { useJobQueue } from "../../../providers/JobQueue";
import type { Address } from "../../../types/domain";
import { useOffline } from "../../app/useOffline";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useHasRole } from "../../roles/useHasRole";
import {
  type CommitmentPoolRecord,
  commitmentNeedsSeat,
  selectCommitmentSeat,
  useCommitmentCycles,
  useCommitmentMetadata,
  useCommitmentQueueState,
  useCommitments,
} from "../../../commitment-pooling";

export type GardenPoolDirection = "all" | "OFFER" | "REQUEST";

const NON_PARTICIPATING_STATES = new Set(["NOT_READY", "READY", "CLOSED", "COMPOSTED"]);

export function useGardenPoolController(pool: CommitmentPoolRecord) {
  const chainId = DEFAULT_CHAIN_ID;
  const viewer = usePrimaryAddress();
  const { isOnline } = useOffline();
  const [selectedCycleId, setSelectedCycleId] = useState<bigint | null>(null);
  const [direction, setDirection] = useState<GardenPoolDirection>("all");
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const { cycles } = useCommitmentCycles({ chainId, poolId: pool.poolId });
  const { hasRole: stewardsPool } = useHasRole(
    pool.garden as Address,
    (viewer ?? undefined) as Address | undefined,
    "steward",
    chainId
  );
  const { hasRole: ownsPool } = useHasRole(
    pool.garden as Address,
    (viewer ?? undefined) as Address | undefined,
    "owner",
    chainId
  );
  const queue = useCommitmentQueueState(viewer as Address | null);
  const { pendingCreates, refresh: refreshQueue } = queue;
  const { flush } = useJobQueue();
  const commitments = useCommitments({
    chainId,
    poolId: pool.poolId,
    cycleId: selectedCycleId ?? undefined,
  });

  const ownCreations = useMemo(
    () => pendingCreates.filter((entry) => entry.poolId === pool.poolId.toString()),
    [pendingCreates, pool.poolId]
  );
  const rows = useMemo(() => {
    const filtered =
      direction === "all"
        ? commitments.commitments
        : commitments.commitments.filter((commitment) => commitment.direction === direction);
    return filtered.map((commitment) => {
      const seat = selectCommitmentSeat({
        commitment,
        contributors: [],
        viewer: (viewer ?? undefined) as Address | undefined,
      });
      return { commitment, seat, needsYou: commitmentNeedsSeat({ commitment, seat }) };
    });
  }, [commitments.commitments, direction, viewer]);
  const { byCID } = useCommitmentMetadata(commitments.commitments);

  const retry = useCallback(
    async (jobId: string) => {
      setBusyJobId(jobId);
      try {
        await jobQueue.retryJob(jobId);
        await flush();
      } finally {
        setBusyJobId(null);
        refreshQueue();
      }
    },
    [flush, refreshQueue]
  );
  const discard = useCallback(
    async (jobId: string) => {
      setBusyJobId(jobId);
      try {
        await jobQueue.discardJob(jobId);
      } finally {
        setBusyJobId(null);
        refreshQueue();
      }
    },
    [refreshQueue]
  );

  const poolState = pool.state ?? "UNKNOWN";
  return {
    chainId,
    isOnline,
    cycles,
    selectedCycleId,
    setSelectedCycleId,
    direction,
    setDirection,
    busyJobId,
    ownCreations,
    rows,
    titleOf: (metadataCID: string | null | undefined) =>
      metadataCID ? (byCID.get(metadataCID)?.title ?? null) : null,
    commitments,
    poolState,
    isParticipating: !NON_PARTICIPATING_STATES.has(poolState),
    canCreate: poolState === "OPEN" && (pool.poolType !== "PROTOCOL" || stewardsPool || ownsPool),
    acts: { flush, retry, discard },
  };
}
