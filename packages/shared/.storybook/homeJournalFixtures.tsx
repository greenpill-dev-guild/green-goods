/**
 * Fictional reads for the Home journal stories (Highlights, Recent Activity, Take Part), as the
 * Shared journal hooks return them: Riverside Commons Garden's season and campaign, its newest
 * work and its open promises, the people and promises the client journeys stories use. Nothing
 * here is a real account, garden or record.
 */
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import type {
  GardenOpenCycles,
  GardenOpenPromises,
  GardenRecentActivity,
  JournalCycle,
  TakePartEntry,
} from "../src/hooks/garden/useGardenJournal";
import enMessages from "../src/i18n/en.json";
import esMessages from "../src/i18n/es.json";
import ptMessages from "../src/i18n/pt.json";
import type { Work } from "../src/types/domain";
import {
  AUTUMN_PLANTING,
  JOURNEY_GARDEN,
  JOURNEY_HELPER,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
  LIVE_PROMISES,
  SEED_SWAP,
} from "./clientJourneyFixtures";
import { daysAgo, FIXTURE_WORK_MEDIA, hoursAgo } from "./fixtures";

export { JOURNEY_CYCLE_NAMES, JOURNEY_GARDEN } from "./clientJourneyFixtures";

export type JournalLocale = "en" | "es" | "pt";

const CATALOGS: Record<JournalLocale, Record<string, string>> = {
  en: enMessages,
  es: esMessages,
  pt: ptMessages,
};

/**
 * One phone's width of Home's canvas in one language. Each journal section brings its own
 * 16px gutter, so the frame has none.
 */
export function JournalPhone({
  width,
  locale = "en",
  children,
}: {
  width: 360 | 390;
  locale?: JournalLocale;
  children: ReactNode;
}) {
  return (
    <IntlProvider locale={locale} messages={CATALOGS[locale]}>
      <div
        lang={locale}
        data-phone={`${width}-${locale}`}
        style={{ width }}
        className="shrink-0 overflow-hidden bg-bg-canvas pb-4 text-text-strong-950"
      >
        {children}
      </div>
    </IntlProvider>
  );
}

/** The six frames a section is proven in: English, Spanish and Portuguese at 360 and 390px. */
export function JournalLocales({ render }: { render: (locale: JournalLocale) => ReactNode }) {
  return (
    <div className="flex flex-col gap-6 bg-bg-weak-50 p-4">
      {([390, 360] as const).map((width) => (
        <div key={width} className="flex items-start gap-4">
          {(["en", "es", "pt"] as const).map((locale) => (
            <JournalPhone key={locale} width={width} locale={locale}>
              {render(locale)}
            </JournalPhone>
          ))}
        </div>
      ))}
    </div>
  );
}

const ACTION_TITLES: Record<number, string> = {
  1: "Compost Turn",
  2: "Seed Library Count",
  3: "Path Edging",
};

function work(
  id: string,
  actionUID: number,
  status: Work["status"],
  createdAtSeconds: number,
  photos: number,
  gardener = JOURNEY_NEIGHBOUR
): Work {
  return {
    id,
    title: "",
    actionUID,
    gardenerAddress: gardener,
    gardenAddress: JOURNEY_GARDEN,
    feedback: "",
    metadata: "",
    media: FIXTURE_WORK_MEDIA.slice(0, photos),
    createdAt: createdAtSeconds * 1000,
    status,
  };
}

/** The garden's three newest works: one waiting for review, one approved, one rejected. */
export const JOURNAL_WORKS: Work[] = [
  work("0xjournal-work-3", 1, "pending", hoursAgo(5), 2),
  work("0xjournal-work-2", 2, "approved", daysAgo(2), 4, JOURNEY_HELPER),
  work("0xjournal-work-1", 3, "rejected", daysAgo(7), 1, JOURNEY_VIEWER),
];

export function recentActivityFixture(
  state: GardenRecentActivity["state"] = { status: "ready", items: JOURNAL_WORKS, savedAt: null }
): GardenRecentActivity {
  return {
    state,
    featured: state.status === "ready" ? (state.items.find((item) => item.media.length) ?? null) : null,
    actionTitleOf: (item) => ACTION_TITLES[item.actionUID],
    refetch: () => undefined,
  };
}

/** The open season and campaign, with the days left a reader would see partway through them. */
export const JOURNAL_CYCLES: JournalCycle[] = [
  { cycle: AUTUMN_PLANTING, name: "Autumn Planting 2026", daysLeft: 36 },
  { cycle: SEED_SWAP, name: "Seed Swap Weekend", daysLeft: 1 },
];

export function openCyclesFixture(
  state: GardenOpenCycles["state"] = { status: "ready", items: JOURNAL_CYCLES, savedAt: null }
): GardenOpenCycles {
  return { state, refetch: () => undefined };
}

/** The live promises still open to take up, and their titles by metadata CID. */
const OPEN_ROWS = LIVE_PROMISES.filter(({ row }) =>
  ["OFFERED", "REQUESTED"].includes(row.commitment.derivedState)
);
const TITLES = new Map(
  OPEN_ROWS.map(({ row, title }) => [row.commitment.metadataCID ?? "", title])
);

export const JOURNAL_ENTRIES: TakePartEntry[] = OPEN_ROWS.map(({ row }) => ({
  kind: "single",
  row: { ...row, seat: "bystander", needsYou: false },
}));

export function openPromisesFixture(
  state: GardenOpenPromises["state"] = { status: "ready", items: JOURNAL_ENTRIES, savedAt: null }
): GardenOpenPromises {
  return {
    state,
    ask:
      state.status === "ready"
        ? (JOURNAL_ENTRIES.find(
            (entry) => entry.kind === "single" && entry.row.commitment.direction === "REQUEST"
          ) ?? null)
        : null,
    titleOf: (cid) => (cid ? (TITLES.get(cid) ?? null) : null),
    refetch: () => undefined,
  };
}
