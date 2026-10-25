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
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Work } from "@green-goods/shared/types/domain";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { type ReactNode, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";

import { getWorkCardLabels } from "@/components/Cards/Work/MinimalWorkCard";
import { groupCountsText, presentState, promiseDueDetail } from "@/components/Features/Commitments";
import { CycleDetailsSheet } from "@/views/Home/Garden/Pool/CycleDetailsSheet";
import { CycleIdentity } from "@/views/Home/Garden/Pool/CycleRail";
import { HighlightCard, HighlightPhoto } from "./HighlightCard";
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
 * It appears only when it has something to show (DL-127): a read still loading or one that
 * failed adds no card. Recent Activity and Take Part draw those reads' states in their own
 * place, and the cycles show only once read, as on the Pool tab's rail. With no card the
 * carousel is absent.
 */
export function HighlightsCarousel({ gardenId }: HighlightsCarouselProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigateToTop();
  const openCommitmentsSheet = useUIStore((state) => state.openCommitmentsSheet);
  const cycles = useGardenOpenCycles(gardenId);
  const activity = useGardenRecentActivity(gardenId);
  const promises = useGardenOpenPromises(gardenId);
  // The last cycle stays drawn while its sheet closes.
  const [details, setDetails] = useState<{ cycle: CommitmentCycleRecord | null; open: boolean }>({
    cycle: null,
    open: false,
  });

  const cards = [
    ...cycleCards(cycles, (cycle) => setDetails({ cycle, open: true })),
    ...workCard(activity, (work) =>
      navigate(`/home/${gardenId}/work/${work.id}`, { state: { from: "home", returnTo: "/home" } })
    ),
    ...askCard(promises, (entry) => navigate(takePartPath(gardenId, entry))),
  ];
  if (cards.length === 0) return null;

  return (
    <JournalSection
      data-component="HighlightsCarousel"
      title={formatMessage({ id: "app.home.journal.highlights" })}
      layout="carousel"
    >
      {cards}
      <CycleDetailsSheet
        cycle={details.cycle}
        isOpen={details.open}
        onClose={() => setDetails((current) => ({ ...current, open: false }))}
        // Until the Promises sheet can open filtered to a cycle (step 11), it opens whole.
        onShowPromises={() => {
          setDetails((current) => ({ ...current, open: false }));
          openCommitmentsSheet();
        }}
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
      key={cycle.id}
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
      key={featured.id}
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
      key={ask.kind === "single" ? ask.row.commitment.id : ask.group.key}
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
  const commitment = entry.kind === "single" ? entry.row.commitment : entry.group.children[0];
  if (!commitment) return null;
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
