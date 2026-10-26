// Command Surface: what the member can take part in, on Home (DL-127, decision 32).
import type { CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
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
 * opening its own page, and See All opening the Promises sheet. There is no second promise
 * workflow here: taking one up happens on its page, as everywhere else.
 */
export function TakePart({ gardenId, withCycleLines = false }: TakePartProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigateToTop();
  const openCommitmentsSheet = useUIStore((state) => state.openCommitmentsSheet);
  const promises = useGardenOpenPromises(gardenId);
  const { state } = promises;

  return (
    <JournalSection
      data-component="TakePart"
      title={formatMessage({ id: "app.home.journal.takePart" })}
      action={{
        label: formatMessage({ id: "app.home.journal.seeAll" }),
        onClick: () => openCommitmentsSheet(),
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
        promises={promises}
        onOpen={(entry) => navigate(takePartPath(gardenId, entry))}
      />
    </JournalSection>
  );
}

function TakePartRows({
  promises: { state, titleOf, refetch },
  onOpen,
}: {
  promises: GardenOpenPromises;
  onOpen: (entry: TakePartEntry) => void;
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
          onRetry={refetch}
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
      return (
        <JournalStateRow
          kind="empty"
          icon={<RiInboxLine />}
          title={formatMessage({ id: "app.home.journal.takePart.emptyTitle" })}
          detail={formatMessage({ id: "app.home.journal.takePart.emptyDetail" })}
        />
      );
    case "ready":
      return state.items.map((entry) =>
        entry.kind === "single" ? (
          <li key={entry.row.commitment.id}>
            <PromiseRow
              row={entry.row}
              title={titleOf(entry.row.commitment.metadataCID)}
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
  const { state } = useGardenOpenCycles(gardenId);
  // The last cycle stays drawn while its sheet closes.
  const [details, setDetails] = useState<{ cycle: CommitmentCycleRecord | null; open: boolean }>({
    cycle: null,
    open: false,
  });
  // Leaving Home closes them with Home's own drawers: they portal past its hidden wrapper.
  const homeShown = useContext(HomeShownContext);
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
