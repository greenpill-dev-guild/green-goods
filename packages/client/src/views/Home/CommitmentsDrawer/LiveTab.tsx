import { Alert } from "@green-goods/shared/components/Alert";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { Garden } from "@green-goods/shared/types/domain";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  type CommitmentPoolRecord,
  type CommitmentsInbox,
  type InboxCommitment,
  useCommitmentMetadata,
} from "@green-goods/shared/commitment-pooling";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";

import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { PWA_DRAWER_SCROLL_CLASSNAME } from "@/components/Pwa/drawerScrollStyles";
import { gardenAddressFor, groupByGarden } from "./grouping";

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
  /** Where a row goes when tapped: the commitment, in its garden. */
  onOpenCommitment: (gardenAddress: string, commitmentId: bigint) => void;
}

/**
 * Everything still moving, grouped by garden.
 *
 * The chips filter by direction rather than by lifecycle, which is the pool
 * tab's own grammar at a wider scope. What needs an act is deliberately not a
 * chip: it leads the sort and drives the badge, so it can never be filtered
 * out of sight.
 */
export function LiveTab({ inbox, pools, gardens, onOpenCommitment }: LiveTabProps) {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const { byCID } = useCommitmentMetadata(
    useMemo(() => inbox.live.map((row) => row.commitment), [inbox.live])
  );
  const [direction, setDirection] = useState<DirectionFilter>("all");

  const { visible, groups } = useMemo(() => {
    const filtered: InboxCommitment[] =
      direction === "all"
        ? inbox.live
        : inbox.live.filter((row) => row.commitment.direction === direction);
    return {
      visible: filtered,
      groups: groupByGarden(
        filtered,
        pools,
        gardens,
        formatMessage({ id: "app.commitments.group.other" })
      ),
    };
  }, [inbox.live, direction, pools, gardens, formatMessage]);

  return (
    <CommitmentStateLadder
      availability={inbox.availability}
      isLoading={inbox.isLoading}
      isError={inbox.isError}
      isOnline={isOnline}
      // A commitment still waiting to send, or one that gave up, has no row to
      // appear in — so the emptiest list is exactly when those notices matter
      // most. Treating the tab as empty would hide the only thing saying so.
      isEmpty={
        inbox.live.length === 0 &&
        !inbox.hasPendingCreate &&
        inbox.unlistedFailureCount === 0 &&
        !inbox.queueUnavailable
      }
      onRetry={() => void inbox.refetch()}
      regionClassName={PWA_DRAWER_SCROLL_CLASSNAME}
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

      {/* Same fact as the pool tab's calm dashed card, same register — a
          queued creation is reassurance, never a warning (DESIGN.pwa warm
          offline indicators). */}
      {inbox.hasPendingCreate ? (
        <Alert variant="info" className="p-3">
          {formatMessage({ id: "app.commitments.pendingCreate" })}
        </Alert>
      ) : null}

      {/* Only the failures no row can name. The rest already say "Didn't send"
        on their own row, and a banner repeating them says the same thing
        twice about one commitment. */}
      {inbox.unlistedFailureCount > 0 ? (
        <Alert variant="error" className="p-3">
          {formatMessage(
            { id: "app.commitments.sendFailed" },
            { count: inbox.unlistedFailureCount }
          )}
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
                "rounded-full border px-3 py-1.5 text-xs font-medium tap-target-lg",
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
              {group.rows.map((row) => {
                const gardenAddress = gardenAddressFor(row, pools);
                return (
                  <CommitmentRow
                    key={row.commitment.id}
                    row={row}
                    title={
                      row.commitment.metadataCID
                        ? (byCID.get(row.commitment.metadataCID)?.title ?? null)
                        : null
                    }
                    sendFailed={inbox.failedCommitmentIds.has(
                      row.commitment.commitmentId.toString()
                    )}
                    onOpen={gardenAddress ? (id) => onOpenCommitment(gardenAddress, id) : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </CommitmentStateLadder>
  );
}
