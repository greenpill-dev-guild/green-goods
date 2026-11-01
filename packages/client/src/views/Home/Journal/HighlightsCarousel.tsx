// Command Surface: What's Open, the open season and campaigns at the top of Home's journal
// (DL-127, DL-133).
import { type CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
import { useGardenOpenCycles } from "@green-goods/shared/hooks/garden/useGardenJournal";
import { useContext, useState } from "react";
import { useIntl } from "react-intl";

import { CycleIdentity } from "@/components/Features/Commitments";
import { HighlightCard } from "./HighlightCard";
import { HomeShownContext } from "./homeShown";
import { JournalCycleDetails } from "./JournalCycleDetails";
import { JournalSection } from "./JournalSection";

export interface HighlightsCarouselProps {
  gardenId: string;
}

/**
 * What's Open (DL-133): the garden's open season and campaigns, one 280×112 card each in a row
 * that scrolls sideways with the next card peeking, each opening the cycle's details sheet.
 * Work stays with Recent Activity and open asks with Take Part, so nothing here repeats a list
 * below. One open cycle is one card at the row's full width. It leads the journal, so while the
 * cycles load it holds its height and nothing under it jumps as they land (DL-156). With none,
 * or once their read failed, the section is absent.
 */
export function HighlightsCarousel({ gardenId }: HighlightsCarouselProps) {
  const { formatMessage } = useIntl();
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

  if (state.status === "loading") {
    return (
      <JournalSection
        data-component="HighlightsCarousel"
        title={formatMessage({ id: "app.home.journal.highlights" })}
        layout="rows"
        busy
      >
        <li aria-hidden="true" className="h-28 rounded-[var(--gg-card-radius)] bg-bg-soft-200" />
      </JournalSection>
    );
  }
  if (state.status !== "ready" || state.items.length === 0) return null;
  const single = state.items.length === 1;

  return (
    <JournalSection
      data-component="HighlightsCarousel"
      title={formatMessage({ id: "app.home.journal.highlights" })}
      layout={single ? "rows" : "carousel"}
    >
      {state.items.map(({ cycle, name, daysLeft }) => (
        <CycleHighlight
          key={`cycle:${cycle.id}`}
          cycle={cycle}
          name={name}
          daysLeft={daysLeft}
          wide={single}
          onOpen={() => setDetails({ cycle, open: true })}
        />
      ))}
      <JournalCycleDetails
        cycle={details.cycle}
        isOpen={details.open}
        onClose={() => setDetails((current) => ({ ...current, open: false }))}
      />
    </JournalSection>
  );
}

function CycleHighlight({
  cycle,
  name,
  daysLeft,
  wide,
  onOpen,
}: {
  cycle: CommitmentCycleRecord;
  name: string | null;
  daysLeft: number | null;
  wide: boolean;
  onOpen: () => void;
}) {
  const { formatMessage } = useIntl();
  const counts = formatMessage(
    { id: "app.pool.rail.counts" },
    { kept: Number(cycle.commitmentsFulfilled), made: Number(cycle.commitmentsDue) }
  );
  return (
    <HighlightCard
      kind="cycle"
      eyebrow={<CycleIdentity cycle={cycle} />}
      title={
        name ??
        formatMessage({
          id: cycle.cycleType === "CAMPAIGN" ? "app.pool.rail.campaign" : "app.pool.rail.season",
        })
      }
      prominent
      wide={wide}
      detail={
        daysLeft === null
          ? counts
          : formatMessage(
              { id: "app.home.journal.highlights.cycleDetail" },
              {
                counts,
                daysLeft: formatMessage(
                  { id: "app.home.journal.highlights.daysLeft" },
                  { count: daysLeft }
                ),
              }
            )
      }
      onOpen={onOpen}
    />
  );
}
