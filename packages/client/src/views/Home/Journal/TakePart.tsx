// Command Surface: what the member can take part in, on Home (DL-127, decision 32).
import type { CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
import type { CommitmentRowProps } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import {
  type GardenOpenPromises,
  type TakePartEntry,
  useGardenOpenCycles,
  useGardenOpenPromises,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { RiInboxLine, RiPlantLine } from "@remixicon/react";
import { type ReactNode, useContext, useState } from "react";
import { useIntl } from "react-intl";

import { formatSavedAt } from "@/components/Communication/Offline/formatSavedAt";
import {
  CycleIdentity,
  cycleDates,
  PromiseGroupRow,
  PromiseRow,
  PromiseRowSkeleton,
} from "@/components/Features/Commitments";
import { HomeShownContext } from "./homeShown";
import { JournalCycleDetails } from "./JournalCycleDetails";
import { JournalSection } from "./JournalSection";
import { JournalLoadingRows, JournalStateRow } from "./JournalStateRow";

export interface TakePartProps {
  gardenId: string;
  /**
   * Stands each open season and campaign as one line at the top of the list, for a Home that
   * does not mount the Highlights carousel, which otherwise carries them (decision 32).
   */
  withCycleLines?: boolean;
}

/**
 * Where a Take Part entry goes: the promise's own page, or its group's, as from the Pool tab,
 * at the group's copy still open to take up.
 */
export function takePartPath(gardenId: string, entry: TakePartEntry): string {
  const copy = entry.copy.commitmentId.toString();
  if (entry.kind === "single") return `/home/${gardenId}/commitments/${copy}`;
  return `/home/${gardenId}/commitments/group/${encodeURIComponent(entry.group.displayGroupId)}?copy=${copy}`;
}

/**
 * Take Part: the garden's open and asked-for promises as the Pool tab's commitment rows, each
 * opening its own page, and See All opening every one of them in a sheet over Home
 * (`TakePartSheet`). There is no second promise workflow here: taking one up happens on its
 * page, as everywhere else.
 */
export function TakePart({ gardenId, withCycleLines = false }: TakePartProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigateToTop();
  const openTakePartSheet = useUIStore((state) => state.openTakePartSheet);
  const promises = useGardenOpenPromises(gardenId);
  const { state } = promises;

  return (
    <JournalSection
      data-component="TakePart"
      title={formatMessage({ id: "app.home.journal.takePart" })}
      action={{
        label: formatMessage({ id: "app.home.journal.seeAll" }),
        onClick: () => openTakePartSheet(),
      }}
      note={
        state.status === "ready" && state.savedAt
          ? formatMessage(
              { id: "app.offline.savedAt" },
              { when: formatSavedAt(intl, state.savedAt) }
            )
          : undefined
      }
      busy={state.status === "loading"}
    >
      {withCycleLines ? <CycleLines gardenId={gardenId} /> : null}
      <TakePartRows
        state={state}
        emptyReason={promises.emptyReason}
        titleOf={promises.titleOf}
        onRetry={promises.refetch}
        onOpen={(entry) => navigate(takePartPath(gardenId, entry))}
      />
    </JournalSection>
  );
}

/**
 * Take Part's rows for one of its reads: the Pool tab's commitment rows, or the one row that
 * stands for them while there are none, they load, or the read failed. The section shows the
 * first entries and the sheet every one.
 */
export function TakePartRows({
  state,
  emptyReason = "none",
  titleOf,
  onRetry,
  onOpen,
  serviceOf,
}: {
  state: GardenOpenPromises["state"];
  /** Why the list is empty, when it is: the empty row says so (DL-132). */
  emptyReason?: GardenOpenPromises["emptyReason"];
  titleOf: GardenOpenPromises["titleOf"];
  onRetry: () => void;
  onOpen: (entry: TakePartEntry) => void;
  /** A service offer's line, where the list reads services; Home's own section reads none. */
  serviceOf?: (commitmentId: bigint) => CommitmentRowProps["service"];
}): ReactNode {
  const { formatMessage } = useIntl();
  switch (state.status) {
    case "loading":
      return (
        <JournalLoadingRows
          label={formatMessage({ id: "app.home.journal.takePart.loading" })}
          count={3}
          placeholder={<PromiseRowSkeleton />}
        />
      );
    case "unavailable":
      return (
        <JournalStateRow
          kind="empty"
          icon={<RiPlantLine />}
          title={formatMessage({ id: "app.home.journal.takePart.unavailableTitle" })}
          detail={formatMessage({ id: "app.home.journal.takePart.unavailableDetail" })}
        />
      );
    case "error":
      return (
        <JournalStateRow
          kind="error"
          title={formatMessage({ id: "app.home.journal.takePart.errorTitle" })}
          onRetry={onRetry}
        />
      );
    case "offline":
      return (
        <JournalStateRow
          kind="offline"
          title={formatMessage({ id: "app.home.journal.offlineTitle" })}
        />
      );
    case "empty":
      // A reader whose own promises are the only open ones hears that, not "nothing open".
      return (
        <JournalStateRow
          kind="empty"
          icon={<RiInboxLine />}
          title={formatMessage({
            id:
              emptyReason === "yours"
                ? "app.home.journal.takePart.yoursTitle"
                : "app.home.journal.takePart.emptyTitle",
          })}
          detail={formatMessage({
            id:
              emptyReason === "yours"
                ? "app.home.journal.takePart.yoursDetail"
                : "app.home.journal.takePart.emptyDetail",
          })}
        />
      );
    case "ready":
      return state.items.map((entry) =>
        entry.kind === "single" ? (
          <li key={entry.row.commitment.id}>
            <PromiseRow
              row={entry.row}
              title={titleOf(entry.row.commitment.metadataCID)}
              service={serviceOf?.(entry.row.commitment.commitmentId)}
              onOpen={() => onOpen(entry)}
            />
          </li>
        ) : (
          <li key={entry.group.key}>
            <PromiseGroupRow
              group={entry.group}
              title={titleOf(entry.copy.metadataCID)}
              onOpen={() => onOpen(entry)}
            />
          </li>
        )
      );
  }
}

/**
 * The open seasons and campaigns as one line each, opening the cycle's details sheet, for a
 * Home without the carousel (decision 32). They show only once read, as on the Pool tab's rail.
 */
function CycleLines({ gardenId }: { gardenId: string }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  // Home shown again reads the cycles' clock afresh, so days left never stand stale under a page.
  const homeShown = useContext(HomeShownContext);
  const { state } = useGardenOpenCycles(gardenId, { shown: homeShown });
  // The last cycle stays drawn while its sheet closes.
  const [details, setDetails] = useState<{ cycle: CommitmentCycleRecord | null; open: boolean }>({
    cycle: null,
    open: false,
  });
  // Leaving Home closes them with Home's own drawers: they portal past its hidden wrapper.
  if (!homeShown && details.open) setDetails((current) => ({ ...current, open: false }));
  if (state.status !== "ready") return null;

  return (
    <>
      {state.items.map(({ cycle, name }) => {
        const counts = formatMessage(
          { id: "app.pool.rail.counts" },
          { kept: Number(cycle.commitmentsFulfilled), made: Number(cycle.commitmentsDue) }
        );
        const dates = cycleDates(intl, cycle, { withYear: false });
        const kind = formatMessage({
          id: cycle.cycleType === "CAMPAIGN" ? "app.pool.rail.campaign" : "app.pool.rail.season",
        });
        return (
          <li key={cycle.id}>
            <button
              type="button"
              data-pressable="row"
              onClick={(event) => {
                // Safari does not focus a pressed button; the details hand focus back to it.
                event.currentTarget.focus({ preventScroll: true });
                setDetails({ cycle, open: true });
              }}
              className="flex min-h-12 w-full min-w-0 items-center gap-2 text-start"
            >
              <span className="flex shrink-0">
                <CycleIdentity cycle={cycle} />
              </span>
              <span className="min-w-0 truncate type-meta text-text-sub-600">
                {formatMessage(
                  { id: "app.home.journal.takePart.cycleLine" },
                  {
                    name: (
                      <strong className="font-semibold text-text-strong-950">{name ?? kind}</strong>
                    ),
                    details: dates
                      ? formatMessage({ id: "app.pool.rail.datesAndCounts" }, { dates, counts })
                      : counts,
                  }
                )}
              </span>
            </button>
          </li>
        );
      })}
      <JournalCycleDetails
        cycle={details.cycle}
        isOpen={details.open}
        onClose={() => setDetails((current) => ({ ...current, open: false }))}
      />
    </>
  );
}
