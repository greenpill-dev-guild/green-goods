import {
  Alert,
  cn,
  type CommitmentPoolRecord,
  type CommitmentsInbox,
  type Garden,
  type InboxCommitment,
  useCommitmentMetadata,
  useOffline,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";

import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";
import { COMMITMENTS_DRAWER_SCROLL_CLASSNAME } from "./classnames";
import { groupByGarden } from "./grouping";

type DirectionFilter = "all" | "OFFER" | "REQUEST";

const DIRECTION_FILTERS: { id: DirectionFilter; labelId: string }[] = [
  { id: "all", labelId: "app.commitments.filter.all" },
  { id: "OFFER", labelId: "app.commitments.filter.offers" },
  { id: "REQUEST", labelId: "app.commitments.filter.requests" },
];

export interface LiveTabProps {
  inbox: CommitmentsInbox;
  pools: CommitmentPoolRecord[];
  gardens: Garden[];
}

/**
 * Everything still moving, grouped by garden.
 *
 * The chips filter by direction rather than by lifecycle, which is the pool
 * tab's own grammar at a wider scope. What needs an act is deliberately not a
 * chip: it leads the sort and drives the badge, so it can never be filtered
 * out of sight.
 */
export function LiveTab({ inbox, pools, gardens }: LiveTabProps) {
  const { formatMessage } = useIntl();
  const { isOnline } = useOffline();
  const { byCID } = useCommitmentMetadata(
    useMemo(() => inbox.live.map((row) => row.commitment), [inbox.live])
  );
  const [direction, setDirection] = useState<DirectionFilter>("all");

  const { visible, groups } = useMemo(() => {
    const filtered: InboxCommitment[] =
      direction === "all"
        ? inbox.live
        : inbox.live.filter((row) => row.commitment.direction === direction);
    return { visible: filtered, groups: groupByGarden(filtered, pools, gardens) };
  }, [inbox.live, direction, pools, gardens]);

  return (
    <CommitmentStateLadder
      availability={inbox.availability}
      isLoading={inbox.isLoading}
      isError={inbox.isError}
      isOnline={isOnline}
      isEmpty={inbox.live.length === 0}
      onRetry={() => void inbox.refetch()}
      regionClassName={COMMITMENTS_DRAWER_SCROLL_CLASSNAME}
      copy={{
        loadingId: "app.commitments.live.loading",
        errorId: "app.commitments.live.error",
        emptyTitleId: "app.commitments.live.emptyTitle",
        emptyDescriptionId: "app.commitments.live.emptyDescription",
      }}
    >
      {inbox.queueUnavailable ? (
        <Alert variant="warning" className="p-3">
          {formatMessage({ id: "app.commitments.queueUnreadable" })}
        </Alert>
      ) : null}

      {inbox.failedJobCount > 0 ? (
        <Alert variant="error" className="p-3">
          {formatMessage({ id: "app.commitments.sendFailed" }, { count: inbox.failedJobCount })}
        </Alert>
      ) : null}

      {/* The chips scroll with the list they filter, which is where the garden
        pool tab already puts them. */}
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
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium tap-target",
                selected
                  ? cn(
                      pwaStatusStyles.primary.border,
                      pwaStatusStyles.primary.surface,
                      pwaStatusStyles.primary.text
                    )
                  : "border-stroke-soft-200 text-text-sub-600"
              )}
            >
              {formatMessage({ id: filter.labelId })}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-sub-600">
          {formatMessage({ id: "app.commitments.filter.noMatches" })}
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.key}>
            <h4
              className="mb-2 truncate text-xs font-medium uppercase tracking-wide text-text-soft-400"
              title={group.gardenName}
            >
              {group.gardenName}
            </h4>
            <div className="space-y-2">
              {group.rows.map((row) => (
                <CommitmentRow
                  key={row.commitment.id}
                  row={row}
                  title={
                    row.commitment.metadataCID
                      ? (byCID.get(row.commitment.metadataCID)?.title ?? null)
                      : null
                  }
                  sendFailed={inbox.failedCommitmentIds.has(row.commitment.commitmentId.toString())}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </CommitmentStateLadder>
  );
}
