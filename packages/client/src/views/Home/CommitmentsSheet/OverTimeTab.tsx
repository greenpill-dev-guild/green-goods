import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { Garden } from "@green-goods/shared/types/domain";
import { CommitmentRow } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  type CommitmentPoolRecord,
  type CommitmentSeriesRecord,
  type CommitmentsInbox,
  useCommitmentMetadata,
} from "@green-goods/shared/commitment-pooling";
import { RiFilterOffLine } from "@remixicon/react";
import { type ReactNode, useMemo } from "react";
import { useIntl } from "react-intl";

import { CommitmentStateLadder, PromiseRow } from "@/components/Features/Commitments";
import { PWA_SHEET_SCROLL_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import { gardenAddressFor, groupByGarden } from "./grouping";

export interface OverTimeTabProps {
  inbox: CommitmentsInbox;
  pools: CommitmentPoolRecord[];
  gardens: Garden[];
  series: CommitmentSeriesRecord[];
  /** Where a row goes when tapped: the commitment, in its garden. */
  onOpenCommitment: (gardenAddress: string, commitmentId: bigint) => void;
  /** Drawn first, in every state that lists: the garden's seasons and campaigns. */
  lead?: ReactNode;
  /** The season or campaign the record and the list count; null counts every promise. */
  cycleId: bigint | null;
  /** Head each garden's kept promises with its name; off once the sheet names its one garden. */
  gardenHeadings: boolean;
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
export function OverTimeTab({
  inbox,
  pools,
  gardens,
  series,
  onOpenCommitment,
  lead,
  cycleId,
  gardenHeadings,
}: OverTimeTabProps) {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const { byCID } = useCommitmentMetadata(
    useMemo(() => inbox.settled.map((row) => row.commitment), [inbox.settled])
  );

  const groups = useMemo(
    () =>
      groupByGarden(
        inbox.settled.filter((row) => cycleId === null || row.commitment.cycleId === cycleId),
        pools,
        gardens,
        formatMessage({ id: "app.commitments.group.other" })
      ),
    [inbox.settled, cycleId, pools, gardens, formatMessage]
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
      regionClassName={PWA_SHEET_SCROLL_CLASSNAME}
      copy={{
        loadingId: "app.commitments.overTime.loading",
        errorId: "app.commitments.overTime.error.title",
        errorDescriptionId: "app.commitments.overTime.error.description",
        emptyTitleId: "app.commitments.overTime.emptyTitle",
        emptyDescriptionId: "app.commitments.overTime.emptyDescription",
        emptyLead: lead,
      }}
    >
      {lead}

      {record.length > 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
          <SheetHeading as="h4">
            {formatMessage({ id: "app.commitments.record.title" })}
          </SheetHeading>
          <FactList frame="inset" className="mt-1">
            {record.map((entry) => (
              <FactRow
                key={entry.key}
                label={entry.gardenName}
                value={formatMessage(
                  { id: "app.commitments.record.counts" },
                  { kept: entry.kept, lapsed: entry.lapsed }
                )}
              />
            ))}
          </FactList>
          <p className="mt-3 text-xs text-text-soft-400">
            {formatMessage({ id: "app.commitments.record.note" })}
          </p>
        </section>
      ) : null}

      {series.length > 0 ? (
        <section>
          <SheetHeading as="h4" className="mb-2">
            {formatMessage({ id: "app.commitments.series.title" })}
          </SheetHeading>
          <div className="flex flex-col gap-(--gg-list-gap)">
            {/* A series offers the same promise again and again, so it leads as an offer. */}
            {series.map((entry) => (
              <CommitmentRow
                key={entry.id}
                data-component="CommitmentSeriesRow"
                direction="OFFER"
                title={formatMessage(
                  { id: "app.commitments.series.instances" },
                  { count: Number(entry.instanceCount) }
                )}
                status={{
                  label: formatMessage({
                    id:
                      entry.state === "ACTIVE"
                        ? "app.commitments.series.active"
                        : "app.commitments.series.stopped",
                  }),
                  tone: entry.state === "ACTIVE" ? "success" : "neutral",
                }}
                note={formatMessage(
                  { id: "app.commitments.series.kept" },
                  { count: Number(entry.fulfilledCount) }
                )}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* A season or campaign may hold nothing settled yet: the filter says so
          rather than leaving its rail over an empty page. */}
      {cycleId !== null && groups.length === 0 ? (
        <EmptyState
          placement="sheet"
          icon={<RiFilterOffLine />}
          title={formatMessage({ id: "app.commitments.overTime.emptyTitle" })}
        />
      ) : null}

      {groups.length > 0 ? (
        <section>
          <SheetHeading as="h4" className="mb-2">
            {formatMessage({ id: "app.commitments.kept.title" })}
          </SheetHeading>
          <div className="space-y-4">
            {(gardenHeadings
              ? groups
              : [{ key: "garden", gardenName: "", rows: groups.flatMap((group) => group.rows) }]
            ).map((group) => (
              <div key={group.key}>
                {gardenHeadings ? (
                  <SheetHeading as="h5" className="mb-2 truncate" title={group.gardenName}>
                    {group.gardenName}
                  </SheetHeading>
                ) : null}
                <div className="flex flex-col gap-(--gg-list-gap)">
                  {group.rows.map((row) => {
                    const gardenAddress = gardenAddressFor(row, pools);
                    return (
                      <PromiseRow
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
