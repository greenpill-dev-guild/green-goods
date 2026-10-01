import { useCallback, useMemo, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import { useJobQueue } from "../../../providers/JobQueue";
import type { Address } from "../../../types/domain";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useGardenMembership } from "../../roles/useGardenMembership";
import { useHasRole } from "../../roles/useHasRole";
import {
  type CommitmentPoolRecord,
  commitmentNeedsSeat,
  isSettledCommitmentState,
  selectCommitmentSeat,
  useCommitmentCycles,
  useCommitmentMetadata,
  useCommitmentQueueState,
  useCommitments,
} from "../../../commitment-pooling";

export type GardenPoolDirection = "all" | "OFFER" | "REQUEST";
export type GardenPoolLiveness = "live" | "settled" | "all";

const NON_PARTICIPATING_STATES = new Set(["NOT_READY", "READY", "CLOSED", "COMPOSTED"]);

export function useGardenPoolController(pool: CommitmentPoolRecord) {
  const chainId = DEFAULT_CHAIN_ID;
  const viewer = usePrimaryAddress();
  const isOnline = useOnlineStatus();
  const [selectedCycleId, setSelectedCycleId] = useState<bigint | null>(null);
  const [direction, setDirection] = useState<GardenPoolDirection>("all");
  // The daily list defaults to the living; the settled are the history, one
  // Status choice away, so kept/withdrawn/lapsed rows never interleave open
  // offers unless the reader asks for All.
  const [liveness, setLiveness] = useState<GardenPoolLiveness>("live");
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const { cycles: poolCycles } = useCommitmentCycles({ chainId, poolId: pool.poolId });
  // A cancelled season is not part of the garden's story: the public garden
  // page leaves it out, and so does the member rail. Commitments it once held
  // stay in the list under All and Settled; only the season's own chip goes.
  const cycles = useMemo(
    () => poolCycles.filter((cycle) => cycle.state !== "CANCELLED"),
    [poolCycles]
  );
  // A season cancelled while it was chosen falls back to All rather than
  // filtering by a season the rail no longer shows.
  const activeCycleId =
    selectedCycleId !== null && cycles.some((cycle) => cycle.cycleId === selectedCycleId)
      ? selectedCycleId
      : null;
  const stewardRole = useHasRole(
    pool.garden as Address,
    (viewer ?? undefined) as Address | undefined,
    "steward",
    chainId
  );
  const ownerRole = useHasRole(
    pool.garden as Address,
    (viewer ?? undefined) as Address | undefined,
    "owner",
    chainId
  );
  const stewardsPool = stewardRole.hasRole;
  const ownsPool = ownerRole.hasRole;
  // Any role in the garden: the contract's own test for starting a promise in a
  // garden's pool. Unknown while it reads or when the read fails, which draws no +.
  const membership = useGardenMembership(
    pool.garden as Address,
    (viewer ?? undefined) as Address | undefined,
    chainId
  );
  const queue = useCommitmentQueueState(viewer as Address | null);
  const { pendingCreates, refresh: refreshQueue } = queue;
  const { retryAndSend } = useJobQueue();
  const commitments = useCommitments({
    chainId,
    poolId: pool.poolId,
    cycleId: activeCycleId ?? undefined,
  });

  const ownCreations = useMemo(
    () => pendingCreates.filter((entry) => entry.poolId === pool.poolId.toString()),
    [pendingCreates, pool.poolId]
  );
  // A creation still on this phone is a live promise to be, of its own kind: it
  // follows Status and Kind like every row, and belongs to no season yet.
  const shownCreations = useMemo(
    () =>
      liveness === "settled"
        ? []
        : ownCreations.filter(
            (creation) => direction === "all" || creation.direction === direction
          ),
    [direction, liveness, ownCreations]
  );
  const { rows, settledCount } = useMemo(() => {
    const inDirection =
      direction === "all"
        ? commitments.commitments
        : commitments.commitments.filter((commitment) => commitment.direction === direction);
    const settledInDirection = inDirection.filter((commitment) =>
      isSettledCommitmentState(commitment.derivedState)
    );
    const scoped =
      liveness === "all"
        ? inDirection
        : liveness === "settled"
          ? settledInDirection
          : inDirection.filter((commitment) => !isSettledCommitmentState(commitment.derivedState));
    return {
      settledCount: settledInDirection.length,
      rows: scoped.map((commitment) => {
        const seat = selectCommitmentSeat({
          commitment,
          contributors: [],
          viewer: (viewer ?? undefined) as Address | undefined,
        });
        return { commitment, seat, needsYou: commitmentNeedsSeat({ commitment, seat }) };
      }),
    };
  }, [commitments.commitments, direction, liveness, viewer]);
  const { byCID } = useCommitmentMetadata(commitments.commitments);

  const retry = useCallback(
    async (jobId: string) => {
      setBusyJobId(jobId);
      try {
        // Retrying one act sends only that act, never the rest of the queue.
        await retryAndSend(jobId);
      } finally {
        setBusyJobId(null);
        refreshQueue();
      }
    },
    [retryAndSend, refreshQueue]
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
    /** Who is reading, so their own copies stay out of a group row. */
    viewer: (viewer ?? null) as Address | null,
    isOnline,
    cycles,
    selectedCycleId: activeCycleId,
    setSelectedCycleId,
    direction,
    setDirection,
    liveness,
    setLiveness,
    settledCount,
    busyJobId,
    /** Every creation on this phone for the pool, whatever the filters. */
    ownCreations,
    /** The creations the list shows under the chosen Status and Kind. */
    shownCreations,
    rows,
    titleOf: (metadataCID: string | null | undefined) =>
      metadataCID ? (byCID.get(metadataCID)?.title ?? null) : null,
    commitments,
    poolState,
    isParticipating: !NON_PARTICIPATING_STATES.has(poolState),
    // Creation needs an open pool and, in a garden's pool, a member: the contract
    // refuses anyone else. The protocol pool takes only its host garden's stewards
    // (CreationChecksLib.resolveCreator) until members' offers there are decided.
    canCreate:
      poolState === "OPEN" &&
      (pool.poolType === "PROTOCOL" ? stewardsPool || ownsPool : membership.isMember === true),
    // Whether the reader stewards the pool's garden. Null until both role reads
    // answer, and while either failed, so no copy assumes an answer it lacks.
    stewardsPool:
      stewardsPool || ownsPool
        ? true
        : stewardRole.isLoading || ownerRole.isLoading || stewardRole.error || ownerRole.error
          ? null
          : false,
    acts: { retry, discard },
  };
}
