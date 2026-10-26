// Command Surface: the garden's highlights at the top of Home's journal (DL-127, decision 32).
import { type CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
import { workStatusPill } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import {
  type GardenOpenCycles,
  type GardenOpenPromises,
  type GardenRecentActivity,
  type TakePartEntry,
  useGardenOpenCycles,
  useGardenOpenPromises,
  useGardenRecentActivity,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import type { Work } from "@green-goods/shared/types/domain";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { type ReactNode, useContext, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";

import { getWorkCardLabels } from "@/components/Cards/Work/MinimalWorkCard";
import {
  CycleIdentity,
  groupCountsText,
  presentState,
  promiseDueDetail,
} from "@/components/Features/Commitments";
import { HighlightCard, HighlightPhoto } from "./HighlightCard";
import { HomeShownContext } from "./homeShown";
import { JournalCycleDetails } from "./JournalCycleDetails";
import { JournalSection } from "./JournalSection";
import { takePartPath } from "./TakePart";

export interface HighlightsCarouselProps {
  gardenId: string;
}

/**
 * The Highlights carousel: one row of equal 280×112 cards with the next one peeking. The pool's
 * open season and campaigns lead, each opening its details sheet; then the garden's newest
 * work with a photo, opening the work; then the newest ask open to take up, opening its page.
 *
 * It appears only when it has something to show (DL-127), once every read has settled: a card
 * slid in ahead of the one in view would scroll the row, so the cards arrive together, in order.
 * A read that failed adds no card. Recent Activity and Take Part draw those reads' states in
 * their own place, and the cycles show only once read, as on the Pool tab's rail. With no card
 * the carousel is absent.
 */
export function HighlightsCarousel({ gardenId }: HighlightsCarouselProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigateToTop();
  // Home shown again reads the cycles' clock afresh, so days left never stand stale under a page.
  const homeShown = useContext(HomeShownContext);
  const cycles = useGardenOpenCycles(gardenId, { shown: homeShown });
  const activity = useGardenRecentActivity(gardenId);
  const promises = useGardenOpenPromises(gardenId);
  // The last cycle stays drawn while its sheet closes.
  const [details, setDetails] = useState<{ cycle: CommitmentCycleRecord | null; open: boolean }>({
    cycle: null,
    open: false,
  });
  // Leaving Home closes them with Home's own drawers: they portal past its hidden wrapper.
  if (!homeShown && details.open) setDetails((current) => ({ ...current, open: false }));

  const settled = [cycles, activity, promises].every(({ state }) => state.status !== "loading");
  const cards = [
    ...cycleCards(cycles, (cycle) => setDetails({ cycle, open: true })),
    ...workCard(activity, (work) =>
      navigate(`/home/${gardenId}/work/${work.id}`, { state: { from: "home", returnTo: "/home" } })
    ),
    ...askCard(promises, (entry) => navigate(takePartPath(gardenId, entry))),
  ];
  if (!settled || cards.length === 0) return null;

  return (
    <JournalSection
      data-component="HighlightsCarousel"
      title={formatMessage({ id: "app.home.journal.highlights" })}
      layout="carousel"
    >
      {cards}
      <JournalCycleDetails
        cycle={details.cycle}
        isOpen={details.open}
        onClose={() => setDetails((current) => ({ ...current, open: false }))}
      />
    </JournalSection>
  );
}

function cycleCards(
  { state }: GardenOpenCycles,
  onOpen: (cycle: CommitmentCycleRecord) => void
): ReactNode[] {
  if (state.status !== "ready") return [];
  return state.items.map(({ cycle, name, daysLeft }) => (
    <CycleHighlight
      key={`cycle:${cycle.id}`}
      cycle={cycle}
      name={name}
      daysLeft={daysLeft}
      onOpen={() => onOpen(cycle)}
    />
  ));
}

function workCard(
  { featured, actionTitleOf }: GardenRecentActivity,
  onOpen: (work: Work) => void
): ReactNode[] {
  if (!featured) return [];
  return [
    <WorkHighlight
      key={`work:${featured.id}`}
      work={featured}
      actionTitle={actionTitleOf(featured)}
      onOpen={() => onOpen(featured)}
    />,
  ];
}

function askCard(
  { ask, titleOf }: GardenOpenPromises,
  onOpen: (entry: TakePartEntry) => void
): ReactNode[] {
  if (!ask) return [];
  return [
    <AskHighlight
      key={`ask:${ask.kind === "single" ? ask.row.commitment.id : ask.group.key}`}
      entry={ask}
      titleOf={titleOf}
      onOpen={() => onOpen(ask)}
    />,
  ];
}

function CycleHighlight({
  cycle,
  name,
  daysLeft,
  onOpen,
}: {
  cycle: CommitmentCycleRecord;
  name: string | null;
  daysLeft: number | null;
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

function WorkHighlight({
  work,
  actionTitle,
  onOpen,
}: {
  work: Work;
  actionTitle: string | undefined;
  onOpen: () => void;
}) {
  const { formatMessage } = useIntl();
  const labels = getWorkCardLabels(formatMessage);
  // Named and pilled as its row on the Work tab names and pills it.
  const title =
    toWorkDisplayTitle(actionTitle, "") ||
    toWorkDisplayTitle(work.title, "") ||
    labels.untitledWork;
  return (
    <HighlightCard
      kind="work"
      eyebrow={<Eyebrow>{formatMessage({ id: "app.home.journal.highlights.recentWork" })}</Eyebrow>}
      title={title}
      status={workStatusPill(work.status, labels)}
      media={work.media[0] ? <HighlightPhoto src={work.media[0]} /> : undefined}
      onOpen={onOpen}
    />
  );
}

function AskHighlight({
  entry,
  titleOf,
  onOpen,
}: {
  entry: TakePartEntry;
  titleOf: GardenOpenPromises["titleOf"];
  onOpen: () => void;
}) {
  const intl = useIntl();
  // A group stands for its copy still open to take up, which may not be its first child.
  const commitment = entry.copy;
  const due = promiseDueDetail(intl, commitment.dueDate);
  return (
    <HighlightCard
      kind="ask"
      eyebrow={
        <Eyebrow>
          {intl.formatMessage({ id: presentState(commitment.derivedState).labelId })}
        </Eyebrow>
      }
      title={
        titleOf(commitment.metadataCID) ??
        unitsOf(intl, commitment) ??
        intl.formatMessage({ id: "app.commitments.row.untitled" })
      }
      detail={
        entry.kind === "group"
          ? groupCountsText(intl, entry.group.counts)
          : due
            ? typeof due === "string"
              ? due
              : due.text
            : unitsOf(intl, commitment)
      }
      onOpen={onOpen}
    />
  );
}

function unitsOf(
  intl: IntlShape,
  commitment: { targetUnits: bigint; unitLabel?: string | null }
): string | null {
  return commitment.unitLabel
    ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
    : null;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="block truncate type-meta-sm font-semibold text-text-sub-600">{children}</span>
  );
}
