/**
 * A garden's month of work for the Activity calendar's stories: a busy day, a few quiet ones
 * and long gaps, as a small garden's month looks, laid out on Storybook's frozen clock.
 */
import { fn } from "storybook/test";
import type { GardenWorkCalendar } from "../src/hooks/admin-ui/garden/useGardenWorkCalendar";
import { buildWorkCalendar, workCalendarStatus } from "../src/hooks/admin-ui/garden/workCalendar";
import type { Work } from "../src/types/domain";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "./adminFixtures";
import { daysAgo } from "./fixtures";

const GARDEN = STORYBOOK_PRIMARY_ADMIN_GARDEN.id;
const GARDENERS = STORYBOOK_PRIMARY_ADMIN_GARDEN.gardeners;

function work(id: string, days: number, status: Work["status"], title: string): Work {
  return {
    id,
    title,
    actionUID: 1,
    gardenerAddress: GARDENERS[Number(id.slice(-1)) % GARDENERS.length],
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [],
    // Mid-morning, so the day a submission lands on is the same in every reviewer's zone.
    createdAt: daysAgo(days) + 10 * 3600,
    status,
  };
}

export const STORY_CALENDAR_WORKS: Work[] = [
  work("w-1", 1, "pending", "Sorted the week's compost"),
  work("w-2", 1, "pending", "Turned the second pile"),
  work("w-3", 1, "approved", "Weighed outgoing compost"),
  work("w-4", 4, "approved", "Collected kitchen scraps"),
  work("w-5", 4, "rejected", "Collected kitchen scraps"),
  work("w-6", 9, "approved", "Planted bean seedlings"),
  work("w-7", 9, "approved", "Watered the nursery beds"),
  work("w-8", 9, "pending", "Mulched the north path"),
  work("w-9", 13, "approved", "Repaired the water tank lid"),
];
/** One submission whose decisions could not be read. */
const UNREAD = new Set(["w-8"]);

const pad = (value: number) => `${value}`.padStart(2, "0");

/** The fixture's busiest day, as the calendar keys it. */
export function storyBusyDay(): string {
  const day = new Date(STORY_CALENDAR_WORKS[0].createdAt * 1000);
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** The day `days` before Storybook's clock, as the calendar keys it. */
export function storyDayKey(days: number): string {
  const day = new Date((daysAgo(days) + 10 * 3600) * 1000);
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** What `useGardenWorkCalendar` hands the Activity tab, built from fixture works. */
export function storyWorkCalendar(
  works: Work[] = STORY_CALENDAR_WORKS,
  overrides: Partial<GardenWorkCalendar> = {},
  openDay?: string,
  /** Where a cut read stopped (seconds); null for a month read in full. */
  readThrough: number | null = null
): GardenWorkCalendar {
  const now = new Date();
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const built = buildWorkCalendar(works, UNREAD, month, now, readThrough);
  return {
    month,
    monthDate: new Date(now.getFullYear(), now.getMonth(), 1),
    weeks: built.weeks,
    counts: built.counts,
    daysWithWork: built.daysWithWork,
    state: "ready",
    stale: false,
    refreshFailed: false,
    complete: readThrough === null,
    isFetching: false,
    isCurrentMonth: true,
    showPreviousMonth: fn(),
    showNextMonth: fn(),
    showCurrentMonth: fn(),
    retry: fn(),
    openDay: built.weeks.flat().find((cell) => cell.day === openDay) ?? null,
    statusOf: (item: Work) => workCalendarStatus(item, UNREAD),
    handleOpenDay: fn(),
    handleCloseDay: fn(),
    openDayWorkHref: openDay ? `/review/work?gardenId=${GARDEN}&day=${openDay}` : null,
    ...overrides,
  } as GardenWorkCalendar;
}

/**
 * A month too busy for one read, cut on the day four days back: that day holds only what was
 * read, and every later day is not read.
 */
export function storyCutCalendar(openDay?: string): GardenWorkCalendar {
  const readThrough = daysAgo(4) + 10 * 3600;
  return storyWorkCalendar(
    STORY_CALENDAR_WORKS.filter((item) => item.createdAt <= readThrough),
    {},
    openDay,
    readThrough
  );
}
