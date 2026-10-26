// Command Surface: the garden's open promises as a sheet over Home (DL-127).
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
  const [cycleId, setCycleId] = useState(() => openingCycleId(opening));
  if (opening !== opened) {
    setOpened(opening);
    if (opening) setCycleId(openingCycleId(opening));
  }

  const cycles = cycleRead.status === "ready" ? cycleRead.items.map(({ cycle }) => cycle) : [];
  // The cycle narrows the list whether or not the rail lists it: the rail may still be unread,
  // or the cycle may have closed on a refetch since Show Its Promises was pressed. Either way the
  // list stays the cycle's, never widened to the garden's unasked; See All widens it.
  const listed = cycles.find((cycle) => cycle.cycleId === cycleId) ?? null;
  const kind =
    listed?.cycleType ??
    (opening && cycleId === openingCycleId(opening) ? opening.cycleType : undefined);
  const { all } = promises;
  const inCycle =
    all.status === "ready" && cycleId !== null
      ? all.items.filter((entry) => entry.copy.cycleId === cycleId)
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
        <CycleRail
          cycles={cycles}
          selectedCycleId={listed?.cycleId ?? null}
          onSelect={setCycleId}
        />
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
            action={
              listed ? undefined : (
                <Button
                  type="button"
                  emphasis="tertiary"
                  size="compact"
                  onClick={() => setCycleId(null)}
                >
                  {formatMessage({ id: "app.home.journal.seeAll" })}
                </Button>
              )
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

/** The cycle an opening names, as the rail's id, or null for the whole list. */
function openingCycleId(opening: TakePartSheetOpening | null): bigint | null {
  const id = opening?.cycleId;
  return id && /^\d+$/.test(id) ? BigInt(id) : null;
}
