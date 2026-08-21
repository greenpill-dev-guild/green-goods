import {
  type Address,
  type CommitmentPoolRecord,
  commitmentNeedsSeat,
  DEFAULT_CHAIN_ID,
  selectCommitmentSeat,
  useCommitmentCycles,
  useCommitmentMetadata,
  useCommitments,
  useOffline,
  usePrimaryAddress,
} from "@green-goods/shared";
import { RiAddLine, RiInformationLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import { CycleRail } from "./CycleRail";
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
    return <PoolLifecycleNotice pool={pool} />;
  }

  return (
    <CommitmentStateLadder
      availability={commitmentsQuery.availability}
      isLoading={commitmentsQuery.isLoading}
      isError={commitmentsQuery.isError}
      isOnline={isOnline}
      isEmpty={commitmentsQuery.commitments.length === 0}
      onRetry={() => void commitmentsQuery.refetch()}
      copy={{
        loadingId: "app.pool.loading",
        errorId: "app.pool.error",
        emptyTitleId: "app.pool.emptyTitle",
        emptyDescriptionId: "app.pool.emptyDescription",
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
                  ? "rounded-full border border-primary-alpha-24 bg-primary-alpha-10 px-3 py-1.5 text-xs font-medium text-primary tap-target"
                  : "rounded-full border border-stroke-soft-200 px-3 py-1.5 text-xs font-medium text-text-sub-600 tap-target"
              }
            >
              {formatMessage({ id: filter.labelId })}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate("commitments/new")}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-3 text-sm font-medium text-text-strong-950 tap-target-lg"
      >
        <RiAddLine className="h-4 w-4" aria-hidden="true" />
        {formatMessage({ id: "app.pool.compose" })}
      </button>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-sub-600">
          {formatMessage({ id: "app.commitments.filter.noMatches" })}
        </p>
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
    </CommitmentStateLadder>
  );
}
