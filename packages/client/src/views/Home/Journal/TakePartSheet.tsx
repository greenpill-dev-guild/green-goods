// Command Surface: the garden's open promises as a sheet over Home (DL-127).
import type { CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import {
  useGardenOpenCycles,
  useGardenOpenPromises,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import { type TakePartSheetOpening, useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Garden } from "@green-goods/shared/types/domain";
import { RiFilterOffLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

import { CycleRail } from "@/components/Features/Commitments";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { JournalStateRow } from "./JournalStateRow";
import { TakePartRows, takePartPath } from "./TakePart";

export interface TakePartSheetProps {
  /** The active garden: whose open promises the sheet lists, named under its title. */
  garden: Pick<Garden, "id" | "name">;
}

/** The season or campaign the list is narrowed to, with its kind, which outlives its rail card. */
interface Narrowed {
  cycleId: bigint;
  cycleType?: CommitmentCycleRecord["cycleType"];
}

/**
 * Every promise in the garden the reader could take up, in one tall sheet over Home: Take Part's
 * whole list, of which the section shows the first rows, as the Pool tab's commitment rows, each
 * opening its promise's page. See All opens it whole, and a season's or campaign's Show Its
 * Promises opens it at that cycle, which the rail above the list widens again. It is not the
 * Promises sheet, which keeps the reader's own promises.
 */
export function TakePartSheet({ garden }: TakePartSheetProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigateToTop();
  const opening = useUIStore((state) => state.takePartSheet);
  const close = useUIStore((state) => state.closeTakePartSheet);
  const promises = useGardenOpenPromises(garden.id);
  const { state: cycleRead } = useGardenOpenCycles(garden.id);

  // The cycle the list is narrowed to, taken afresh each time the sheet opens.
  const [opened, setOpened] = useState(opening);
  const [narrowed, setNarrowed] = useState(() => openingNarrowed(opening));
  if (opening !== opened) {
    setOpened(opening);
    if (opening) setNarrowed(openingNarrowed(opening));
  }

  const cycles = cycleRead.status === "ready" ? cycleRead.items.map(({ cycle }) => cycle) : [];
  const choose = (cycleId: bigint | null) =>
    setNarrowed(
      cycleId === null
        ? null
        : { cycleId, cycleType: cycles.find((cycle) => cycle.cycleId === cycleId)?.cycleType }
    );
  // The cycle narrows the list whether or not the rail lists it: the rail may still be unread,
  // or the cycle may have closed on a refetch since it was chosen. Either way the list stays the
  // cycle's, never widened to the garden's unasked, and See All widens it when the rail cannot.
  const listed = cycles.find((cycle) => cycle.cycleId === narrowed?.cycleId) ?? null;
  const kind = listed?.cycleType ?? narrowed?.cycleType;
  const { all } = promises;
  const inCycle =
    all.status === "ready" && narrowed
      ? all.items.filter((entry) => entry.copy.cycleId === narrowed.cycleId)
      : null;

  return (
    <AppSheet
      isOpen={opening !== null}
      onClose={close}
      size="tall"
      header={{
        title: formatMessage({ id: "app.home.journal.takePart" }),
        description: formatMessage({ id: "app.common.inGarden" }, { garden: garden.name }),
      }}
    >
      {cycles.length > 0 ? (
        <CycleRail cycles={cycles} selectedCycleId={listed?.cycleId ?? null} onSelect={choose} />
      ) : null}
      {narrowed && !listed ? (
        <div className="flex justify-end">
          <Button type="button" emphasis="tertiary" size="compact" onClick={() => choose(null)}>
            {formatMessage({ id: "app.home.journal.seeAll" })}
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-(--gg-list-gap)">
        {inCycle && inCycle.length === 0 ? (
          <JournalStateRow
            kind="empty"
            icon={<RiFilterOffLine />}
            title={formatMessage(
              { id: "app.home.journal.takePart.cycleEmptyTitle" },
              { kind: kind === "CAMPAIGN" ? "campaign" : "season" }
            )}
            // The card to tap again is on the rail only while it lists the cycle.
            detail={
              listed
                ? formatMessage({ id: "app.home.journal.takePart.cycleEmptyDetail" })
                : undefined
            }
          />
        ) : (
          <TakePartRows
            state={inCycle && all.status === "ready" ? { ...all, items: inCycle } : all}
            titleOf={promises.titleOf}
            onRetry={promises.refetch}
            onOpen={(entry) => {
              // The sheet sits over Home, so it goes away before the promise's page opens.
              close();
              navigate(takePartPath(garden.id, entry));
            }}
          />
        )}
      </ul>
    </AppSheet>
  );
}

/** The cycle an opening names, with its kind, or null for the whole list. */
function openingNarrowed(opening: TakePartSheetOpening | null): Narrowed | null {
  const id = opening?.cycleId;
  return id && /^\d+$/.test(id) ? { cycleId: BigInt(id), cycleType: opening?.cycleType } : null;
}
