import {
  type Address,
  DEFAULT_CHAIN_ID,
  jobQueue,
  useHasRole,
  useJobQueue,
  useOffline,
  usePrimaryAddress,
} from "@green-goods/shared";
import {
  type CommitmentPoolRecord,
  commitmentNeedsSeat,
  selectCommitmentSeat,
  useCommitmentCycles,
  useCommitmentMetadata,
  useCommitmentQueueState,
  useCommitments,
} from "@green-goods/shared/commitment-pooling";
import { RiHandHeartLine, RiInformationLine, RiSeedlingLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import { CycleRail } from "./CycleRail";
import { PendingCreationRow } from "./PendingCreationRow";
import { type CommitmentDoor, PoolCreateEntry } from "./PoolCreateEntry";
import { PoolLifecycleNotice } from "./PoolLifecycleNotice";

export interface GardenPoolProps {
  pool: CommitmentPoolRecord;
}

type DirectionFilter = "all" | "OFFER" | "REQUEST";

const DIRECTION_FILTERS: { id: DirectionFilter; labelId: string }[] = [
  { id: "all", labelId: "app.commitments.filter.all" },
  { id: "OFFER", labelId: "app.commitments.filter.offers" },
  { id: "REQUEST", labelId: "app.commitments.filter.requests" },
];

/** States where the pool is not taking part, so browsing is not the answer. */
const NON_PARTICIPATING = new Set(["NOT_READY", "READY", "CLOSED", "COMPOSTED"]);

/**
 * A garden's pool: what its neighbours have offered and asked for.
 *
 * The tab reads top to bottom the way the garden works. What is running comes
 * first, then what the pool is for, then the commitments themselves. Nothing
 * sits between the seasons and the list.
 */
export function GardenPool({ pool }: GardenPoolProps) {
  const { formatMessage } = useIntl();
  const { isOnline } = useOffline();
  const viewer = usePrimaryAddress();
  const navigate = useNavigate();
  const chainId = DEFAULT_CHAIN_ID;

  const [selectedCycleId, setSelectedCycleId] = useState<bigint | null>(null);
  const [direction, setDirection] = useState<DirectionFilter>("all");

  const { cycles } = useCommitmentCycles({ chainId, poolId: pool.poolId });
  const { hasRole: stewardsPool } = useHasRole(
    pool.garden as Address,
    (viewer ?? undefined) as Address | undefined,
    "operator",
    chainId
  );
  const { hasRole: ownsPool } = useHasRole(
    pool.garden as Address,
    (viewer ?? undefined) as Address | undefined,
    "owner",
    chainId
  );
  // What this phone still holds for this pool: creations waiting to send,
  // waiting for a garden hat, or given up. They ride the top of the list so
  // landing back here with the thing visible is the confirmation.
  const queue = useCommitmentQueueState(viewer as Address | null);
  const { flush } = useJobQueue();
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const ownCreations = useMemo(
    () => queue.pendingCreates.filter((entry) => entry.poolId === pool.poolId.toString()),
    [queue.pendingCreates, pool.poolId]
  );
  const retryCreation = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      await jobQueue.retryJob(jobId);
      await flush();
    } finally {
      setBusyJobId(null);
      queue.refresh();
    }
  };
  const discardCreation = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      await jobQueue.discardJob(jobId);
    } finally {
      setBusyJobId(null);
      queue.refresh();
    }
  };
  const commitmentsQuery = useCommitments({
    chainId,
    poolId: pool.poolId,
    cycleId: selectedCycleId ?? undefined,
  });

  const rows = useMemo(() => {
    const filtered =
      direction === "all"
        ? commitmentsQuery.commitments
        : commitmentsQuery.commitments.filter((c) => c.direction === direction);
    return filtered.map((commitment) => {
      // Browse has no team roster loaded, so an empty team is the honest input:
      // it can name the parties, and it never guesses that a reader is on a
      // team it cannot see.
      const seat = selectCommitmentSeat({
        commitment,
        contributors: [],
        viewer: (viewer ?? undefined) as Address | undefined,
      });
      return {
        commitment,
        seat,
        // Asked of the same act table as the sheet's badge and the detail bar,
        // and of the narrower question: not "can I do something here" but "is
        // somebody held up by me". Withdrawing or taking up is the reader's
        // own option and never marks a row.
        needsYou: commitmentNeedsSeat({ commitment, seat }),
      };
    });
  }, [commitmentsQuery.commitments, direction, viewer]);

  const { byCID } = useCommitmentMetadata(commitmentsQuery.commitments);
  const poolState = pool.state ?? "UNKNOWN";

  if (NON_PARTICIPATING.has(poolState)) {
    // A creation queued before the pool closed can never land now, and these
    // rows are the only way to throw its record away. They stay reachable
    // above the notice; retry is pointless here, so only discard is offered.
    return (
      <div className="space-y-3">
        {ownCreations.map((creation) => (
          <PendingCreationRow
            key={creation.jobId}
            creation={{ ...creation, failed: true }}
            isBusy={busyJobId === creation.jobId}
            onRetry={() => undefined}
            onDiscard={discardCreation}
            discardOnly
          />
        ))}
        <PoolLifecycleNotice pool={pool} />
      </div>
    );
  }

  // The door fixes the direction; the form never asks it again. Creation is
  // only offered while the pool is open, since a paused pool takes nothing,
  // and on the protocol pool only to its stewards: the contract refuses any
  // other creator there (CreationChecksLib.resolveCreator), so a member's door
  // would queue an act that can only revert.
  const openDoor = (door: CommitmentDoor) => navigate(`commitments/new?direction=${door}`);
  const canCreate =
    poolState === "OPEN" && (pool.poolType !== "PROTOCOL" || stewardsPool || ownsPool);

  return (
    <CommitmentStateLadder
      availability={commitmentsQuery.availability}
      isLoading={commitmentsQuery.isLoading}
      isError={commitmentsQuery.isError}
      isOnline={isOnline}
      // A creation still on this phone is a row, so the list is not empty.
      isEmpty={commitmentsQuery.commitments.length === 0 && ownCreations.length === 0}
      onRetry={() => void commitmentsQuery.refetch()}
      copy={{
        loadingId: "app.pool.loading",
        errorId: "app.pool.error",
        emptyTitleId: "app.pool.emptyTitle",
        emptyDescriptionId: "app.pool.emptyDescription",
        // A paused pool says so whether or not it holds anything yet.
        emptyLead: poolState === "PAUSED" ? <PoolLifecycleNotice pool={pool} inline /> : undefined,
        // An empty pool keeps its big inline doors and draws no floating entry:
        // there is nothing to scroll past, and the invitation is the screen.
        emptyAction: canCreate ? (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => openDoor("offer")}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
            >
              <RiSeedlingLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.pool.empty.offer" })}
            </button>
            <button
              type="button"
              onClick={() => openDoor("request")}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 text-sm font-medium text-text-strong-950 tap-target-lg"
            >
              <RiHandHeartLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.pool.empty.request" })}
            </button>
          </div>
        ) : undefined,
      }}
    >
      {poolState === "PAUSED" ? <PoolLifecycleNotice pool={pool} inline /> : null}

      <CycleRail cycles={cycles} selectedCycleId={selectedCycleId} onSelect={setSelectedCycleId} />

      <p className="flex gap-2 text-xs leading-relaxed text-text-sub-600">
        <RiInformationLine className="h-4 w-4 shrink-0" aria-hidden="true" />
        {formatMessage({ id: "app.pool.charter" })}
      </p>

      <div
        className="flex gap-2"
        role="group"
        aria-label={formatMessage({ id: "app.commitments.filter.label" })}
      >
        {DIRECTION_FILTERS.map((filter) => {
          const selected = filter.id === direction;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setDirection(filter.id)}
              className={
                selected
                  ? "rounded-full border border-primary-alpha-24 bg-primary-alpha-10 px-3 py-1.5 text-xs font-medium text-primary tap-target-lg"
                  : "rounded-full border border-stroke-soft-200 px-3 py-1.5 text-xs font-medium text-text-sub-600 tap-target-lg"
              }
            >
              {formatMessage({ id: filter.labelId })}
            </button>
          );
        })}
      </div>

      {ownCreations.length > 0 ? (
        <div className="space-y-2" data-component="PoolPendingCreations">
          {ownCreations.map((creation) => (
            <PendingCreationRow
              key={creation.jobId}
              creation={creation}
              isBusy={busyJobId === creation.jobId}
              onRetry={(jobId) => void retryCreation(jobId)}
              onDiscard={(jobId) => void discardCreation(jobId)}
            />
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        ownCreations.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-sub-600">
            {formatMessage({ id: "app.commitments.filter.noMatches" })}
          </p>
        ) : null
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <CommitmentRow
              key={row.commitment.id}
              row={row}
              title={
                row.commitment.metadataCID
                  ? (byCID.get(row.commitment.metadataCID)?.title ?? null)
                  : null
              }
              onOpen={(id) => navigate(`commitments/${id.toString()}`)}
            />
          ))}
        </div>
      )}

      {canCreate ? <PoolCreateEntry onChoose={openDoor} /> : null}
    </CommitmentStateLadder>
  );
}
