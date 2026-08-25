import type { Garden } from "@green-goods/shared/types/domain";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import {
  type CommitmentPoolRecord,
  type CommitmentSeriesRecord,
  type CommitmentsInbox,
  useCommitmentMetadata,
} from "@green-goods/shared/commitment-pooling";
import { useMemo } from "react";
import { useIntl } from "react-intl";

import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import { PWA_DRAWER_SCROLL_CLASSNAME } from "@/components/Pwa/drawerScrollStyles";
import { gardenAddressFor, groupByGarden } from "./grouping";

export interface OverTimeTabProps {
  inbox: CommitmentsInbox;
  pools: CommitmentPoolRecord[];
  gardens: Garden[];
  series: CommitmentSeriesRecord[];
  /** Where a row goes when tapped: the commitment, in its garden. */
  onOpenCommitment: (gardenAddress: string, commitmentId: bigint) => void;
}

/**
 * What has settled and what stands: the member's own record, the things they
 * keep offering, and their kept history.
 *
 * The record is counted per garden and left in its own units. It is never
 * summed across unlike units and never turned into a rate here: a single lapsed
 * commitment in a three-person garden must not read as a third of a failure.
 * Lapsed appears because this is the member's own view of themselves.
 */
export function OverTimeTab({ inbox, pools, gardens, series, onOpenCommitment }: OverTimeTabProps) {
  const { formatMessage } = useIntl();
  const { isOnline } = useOffline();
  const { byCID } = useCommitmentMetadata(
    useMemo(() => inbox.settled.map((row) => row.commitment), [inbox.settled])
  );

  const groups = useMemo(
    () =>
      groupByGarden(
        inbox.settled,
        pools,
        gardens,
        formatMessage({ id: "app.commitments.group.other" })
      ),
    [inbox.settled, pools, gardens, formatMessage]
  );

  const record = useMemo(
    () =>
      groups.map((group) => ({
        key: group.key,
        gardenName: group.gardenName,
        kept: group.rows.filter(
          (row) =>
            row.commitment.derivedState === "FULFILLED" ||
            row.commitment.derivedState === "RECONCILED"
        ).length,
        lapsed: group.rows.filter((row) => row.commitment.derivedState === "EXPIRED").length,
      })),
    [groups]
  );

  return (
    <CommitmentStateLadder
      availability={inbox.availability}
      isLoading={inbox.isLoading}
      isError={inbox.isError}
      isOnline={isOnline}
      isEmpty={inbox.settled.length === 0 && series.length === 0}
      onRetry={() => void inbox.refetch()}
      regionClassName={PWA_DRAWER_SCROLL_CLASSNAME}
      copy={{
        loadingId: "app.commitments.overTime.loading",
        errorId: "app.commitments.overTime.error",
        emptyTitleId: "app.commitments.overTime.emptyTitle",
        emptyDescriptionId: "app.commitments.overTime.emptyDescription",
      }}
    >
      {record.length > 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
          <h4 className="text-sm font-medium text-text-strong-950">
            {formatMessage({ id: "app.commitments.record.title" })}
          </h4>
          <dl className="mt-3 space-y-2">
            {record.map((entry) => (
              <div key={entry.key} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 truncate text-sm text-text-sub-600" title={entry.gardenName}>
                  {entry.gardenName}
                </dt>
                <dd className="shrink-0 text-sm text-text-strong-950">
                  {formatMessage(
                    { id: "app.commitments.record.counts" },
                    { kept: entry.kept, lapsed: entry.lapsed }
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-text-soft-400">
            {formatMessage({ id: "app.commitments.record.note" })}
          </p>
        </section>
      ) : null}

      {series.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({ id: "app.commitments.series.title" })}
          </h4>
          <div className="space-y-2">
            {series.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-strong-950">
                    {formatMessage(
                      { id: "app.commitments.series.instances" },
                      { count: Number(entry.instanceCount) }
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-sub-600">
                    {formatMessage(
                      { id: "app.commitments.series.kept" },
                      { count: Number(entry.fulfilledCount) }
                    )}
                  </p>
                </div>
                <StatusBadge size="sm" variant={entry.state === "ACTIVE" ? "success" : "neutral"}>
                  {formatMessage({
                    id:
                      entry.state === "ACTIVE"
                        ? "app.commitments.series.active"
                        : "app.commitments.series.stopped",
                  })}
                </StatusBadge>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {groups.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({ id: "app.commitments.kept.title" })}
          </h4>
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="mb-2 truncate text-xs text-text-soft-400" title={group.gardenName}>
                  {group.gardenName}
                </p>
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
                        onOpen={
                          gardenAddress ? (id) => onOpenCommitment(gardenAddress, id) : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </CommitmentStateLadder>
  );
}
