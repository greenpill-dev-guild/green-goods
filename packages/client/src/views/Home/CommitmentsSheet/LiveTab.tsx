import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { Chip } from "@green-goods/shared/components/Chip";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { Garden } from "@green-goods/shared/types/domain";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  type CommitmentPoolRecord,
  type CommitmentsInbox,
  type InboxCommitment,
  useCommitmentMetadata,
} from "@green-goods/shared/commitment-pooling";
import { RiFilterOffLine } from "@remixicon/react";
import { type ReactNode, useLayoutEffect, useMemo, useState } from "react";
import type { CommitmentsDirectionFilter } from "@green-goods/shared/stores/useUIStore";
import { useIntl } from "react-intl";

import { CommitmentStateLadder, PromiseRow } from "@/components/Features/Commitments";
import { PWA_SHEET_SCROLL_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { foldIdenticalCopies, gardenAddressFor, groupByGarden, type LiveEntry } from "./grouping";

const DIRECTION_FILTERS: { id: CommitmentsDirectionFilter; labelId: string }[] = [
  { id: "all", labelId: "app.commitments.filter.all" },
  { id: "OFFER", labelId: "app.commitments.filter.offers" },
  { id: "REQUEST", labelId: "app.commitments.filter.requests" },
];

export interface LiveTabProps {
  inbox: CommitmentsInbox;
  direction: CommitmentsDirectionFilter;
  onDirectionChange: (direction: CommitmentsDirectionFilter) => void;
  pools: CommitmentPoolRecord[];
  gardens: Garden[];
  /** A queued promise goes only when the reader sends it (a wallet sign-in). */
  sendsFromTap: boolean;
  /** Where a row goes when tapped: the commitment, in its garden. */
  onOpenCommitment: (gardenAddress: string, commitmentId: bigint) => void;
  /** Drawn first, in every state that lists: the garden's seasons and campaigns. */
  lead?: ReactNode;
  /** The season or campaign the list shows; null shows every promise. */
  cycleId: bigint | null;
  /** Head each garden's promises with its name; off once the sheet names its one garden. */
  gardenHeadings: boolean;
  /** A promise's page is open over the sheet, so the list of copies waits for its return. */
  covered: boolean;
  /** The reader's take-up requests still waiting on a steward's yes, each on its ask. */
  waiting?: InboxCommitment[];
  /** Ids of the listed promises that nobody took up and that are past due on the chain's clock. */
  pastDueIds?: ReadonlySet<string>;
  /** Where the read behind `waiting` stands, so an unanswered read never passes for none. */
  waitingRead?: { isLoading: boolean; isError: boolean; retry: () => void };
}

/** The copies a folded row opens: drawn while they close, and already in place on the way back. */
interface OpenCopies {
  /** Their fold is found again by its copies: what folds them shifts as their words are read. */
  ids: ReadonlySet<bigint>;
  open: boolean;
  entryMotion: "slide" | "instant";
}

/**
 * Everything still moving, grouped by garden.
 *
 * The chips filter by direction rather than by lifecycle, which is the pool
 * tab's own grammar at a wider scope. What needs an act is deliberately not a
 * chip: it leads the sort and drives the badge, so it can never be filtered
 * out of sight.
 *
 * Identical open copies are one row with their number on the tile (DL-150), and
 * tapping it lists them in a half sheet, as a cycle's details open over this
 * sheet. Each copy is its own row into its own page; Back returns to the list.
 */
export function LiveTab({
  inbox,
  pools,
  gardens,
  sendsFromTap,
  onOpenCommitment,
  direction,
  onDirectionChange,
  lead,
  cycleId,
  gardenHeadings,
  covered,
  waiting = [],
  pastDueIds,
  waitingRead,
}: LiveTabProps) {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const { byCID } = useCommitmentMetadata(
    useMemo(() => [...inbox.live, ...waiting].map((row) => row.commitment), [inbox.live, waiting])
  );
  const [openCopies, setOpenCopies] = useState<OpenCopies>({
    ids: new Set(),
    open: false,
    entryMotion: "slide",
  });
  // Back from a copy's page, the list of copies opens again once the sheet under it is showing:
  // the order they open in by hand, which is what keeps focus, Escape and the list on top.
  const [wasCovered, setWasCovered] = useState(covered);
  useLayoutEffect(() => setWasCovered(covered), [covered]);

  const { visible, groups, titleOf } = useMemo(() => {
    const titleOf = ({ commitment }: InboxCommitment) =>
      commitment.metadataCID ? (byCID.get(commitment.metadataCID)?.title ?? null) : null;
    const filtered: InboxCommitment[] = inbox.live.filter(
      (row) =>
        (direction === "all" || row.commitment.direction === direction) &&
        (cycleId === null || row.commitment.cycleId === cycleId)
    );
    // One garden named in the header holds every row; otherwise each garden heads its own.
    const byGarden = gardenHeadings
      ? groupByGarden(
          filtered,
          pools,
          gardens,
          formatMessage({ id: "app.commitments.group.other" })
        )
      : [{ key: "garden", gardenName: "", rows: filtered }];
    return {
      visible: filtered,
      titleOf,
      groups: byGarden.map(({ rows, ...group }) => ({
        ...group,
        entries: foldIdenticalCopies(rows, byCID, inbox.failedCommitmentIds),
      })),
    };
  }, [
    inbox.live,
    inbox.failedCommitmentIds,
    byCID,
    direction,
    cycleId,
    gardenHeadings,
    pools,
    gardens,
    formatMessage,
  ]);

  // A take-up request waits under the same chips and season as the list it heads.
  const shownWaiting = waiting.filter(
    (row) =>
      (direction === "all" || row.commitment.direction === direction) &&
      (cycleId === null || row.commitment.cycleId === cycleId)
  );

  const promiseRow = (
    row: InboxCommitment,
    beforeOpen?: () => void,
    options: { takeUpRequested?: boolean } = {}
  ) => {
    const gardenAddress = gardenAddressFor(row, pools);
    return (
      <PromiseRow
        key={row.commitment.id}
        row={row}
        title={titleOf(row)}
        takeUpRequested={options.takeUpRequested}
        pastDue={pastDueIds?.has(row.commitment.id) ?? false}
        sendFailed={inbox.failedCommitmentIds.has(row.commitment.commitmentId.toString())}
        onOpen={
          gardenAddress
            ? (id) => {
                beforeOpen?.();
                onOpenCommitment(gardenAddress, id);
              }
            : undefined
        }
      />
    );
  };
  const copiesOnScreen = groups
    .flatMap((group) => group.entries)
    .find(
      (entry): entry is Extract<LiveEntry, { kind: "copies" }> =>
        entry.kind === "copies" &&
        entry.rows.some((row) => openCopies.ids.has(row.commitment.commitmentId))
    );

  // A commitment still waiting to send, or one that gave up, has no row to
  // appear in — so the emptiest list is exactly when those notices matter
  // most. Treating the tab as empty would hide the only thing saying so.
  const listsNothing =
    inbox.live.length === 0 &&
    waiting.length === 0 &&
    !inbox.hasPendingCreate &&
    inbox.unlistedFailureCount === 0 &&
    !inbox.queueUnavailable;
  // With nothing else to show, the take-up requests still unread keep the tab loading, and a
  // read of them that failed is the tab's failure, so it never says nothing is moving.
  const waitingUnsure = listsNothing && waitingRead !== undefined;

  return (
    <CommitmentStateLadder
      availability={inbox.availability}
      isLoading={inbox.isLoading || (waitingUnsure && waitingRead.isLoading)}
      isError={inbox.isError || (waitingUnsure && waitingRead.isError)}
      isOnline={isOnline}
      isEmpty={listsNothing}
      onRetry={() => {
        void inbox.refetch();
        waitingRead?.retry();
      }}
      regionClassName={PWA_SHEET_SCROLL_CLASSNAME}
      copy={{
        loadingId: "app.commitments.live.loading",
        errorId: "app.commitments.live.error.title",
        errorDescriptionId: "app.commitments.live.error.description",
        emptyTitleId: "app.commitments.live.emptyTitle",
        emptyDescriptionId: "app.commitments.live.emptyDescription",
        emptyLead: lead,
      }}
    >
      {lead}

      {inbox.queueUnavailable ? (
        <Alert variant="warning" className="p-3">
          {formatMessage({ id: "app.commitments.queueUnreadable" })}
        </Alert>
      ) : null}

      {/* Same fact as the pool tab's calm dashed card, same register — a
          queued creation is reassurance, never a warning (DESIGN.pwa warm
          offline indicators). A wallet reader's goes only when they send it,
          so theirs says where to do that. */}
      {inbox.hasPendingCreate ? (
        <Alert variant="info" className="p-3">
          {formatMessage({
            id: sendsFromTap
              ? "app.commitments.pendingCreateUnsent"
              : "app.commitments.pendingCreate",
          })}
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
            <Chip key={filter.id} selected={selected} onClick={() => onDirectionChange(filter.id)}>
              {formatMessage({ id: filter.labelId })}
            </Chip>
          );
        })}
      </div>

      {visible.length === 0 ? (
        // A take-up request under the filters still lists, so the filters matched something.
        shownWaiting.length > 0 ? null : (
          <EmptyState
            placement="sheet"
            icon={<RiFilterOffLine />}
            title={formatMessage({ id: "app.commitments.filter.noMatches" })}
          />
        )
      ) : (
        groups.map((group) => (
          <div key={group.key}>
            {gardenHeadings ? (
              <SheetHeading as="h4" className="mb-2 truncate" title={group.gardenName}>
                {group.gardenName}
              </SheetHeading>
            ) : null}
            <div className="flex flex-col gap-(--gg-list-gap)">
              {group.entries.map((entry) => {
                if (entry.kind === "row") return promiseRow(entry.row);
                const [first] = entry.rows;
                return (
                  <PromiseRow
                    key={first.commitment.id}
                    row={first}
                    title={titleOf(first)}
                    copies={entry.rows.length}
                    pastDue={pastDueIds?.has(first.commitment.id) ?? false}
                    onOpen={() =>
                      setOpenCopies({
                        ids: new Set(entry.rows.map((row) => row.commitment.commitmentId)),
                        open: true,
                        entryMotion: "slide",
                      })
                    }
                  />
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* A take-up request is the reader's business too, though nothing is theirs until a
          steward says yes, so it follows their promises under its own heading (PRD-1368). */}
      {shownWaiting.length > 0 ? (
        <section data-component="WaitingOnSteward">
          <SheetHeading as="h4" className="mb-2">
            {formatMessage({ id: "app.commitments.waiting.title" })}
          </SheetHeading>
          <div className="flex flex-col gap-(--gg-list-gap)">
            {shownWaiting.map((row) => promiseRow(row, undefined, { takeUpRequested: true }))}
          </div>
        </section>
      ) : null}

      {/* Beside a list, a failed read of the take-up requests says so where they would be. */}
      {waitingRead?.isError && !waitingUnsure ? (
        <Alert variant="warning" className="p-3">
          <div className="flex flex-col items-start gap-2">
            <p>{formatMessage({ id: "app.commitments.waiting.error" })}</p>
            <Button type="button" emphasis="secondary" size="sm" onClick={waitingRead.retry}>
              {formatMessage({ id: "app.commitments.retry" })}
            </Button>
          </div>
        </Alert>
      ) : null}

      {copiesOnScreen && !covered && !wasCovered ? (
        <AppSheet
          isOpen={openCopies.open}
          entryMotion={openCopies.entryMotion}
          onClose={() => setOpenCopies((current) => ({ ...current, open: false }))}
          size="half"
          header={{
            title:
              titleOf(copiesOnScreen.rows[0]) ??
              formatMessage({ id: "app.commitments.row.untitled" }),
            description: formatMessage(
              { id: "app.pool.group.row.name" },
              { count: copiesOnScreen.rows.length }
            ),
          }}
        >
          <div className="flex flex-col gap-(--gg-list-gap)">
            {copiesOnScreen.rows.map((row) =>
              promiseRow(row, () =>
                setOpenCopies((current) => ({ ...current, entryMotion: "instant" }))
              )
            )}
          </div>
        </AppSheet>
      ) : null}
    </CommitmentStateLadder>
  );
}
