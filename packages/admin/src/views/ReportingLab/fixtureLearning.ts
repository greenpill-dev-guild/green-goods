/**
 * Garden reporting lab: Hilltop's synthetic work records. Sessions run on Tuesdays and
 * Thursdays in term, each planned the Monday before; a reading club meets on some
 * Saturdays over the holidays. Two planned sessions never happened, and the steward
 * last reviewed on Dec 19, so the queue has stalled by the reference date.
 */
import { addDays, type DayKey, eachDay, instantAt, weekdayIndex, weekStartOf } from "./dates";
import { EDU_ACTIONS, LEARNING_ZONE } from "./fixtureLearningGarden";
import {
  applyReview,
  between,
  createRandom,
  LAB_REFERENCE_MS,
  nextReviewDay,
  type Random,
  type ReviewPlan,
} from "./fixtureTools";
import type { WorkRecord } from "./model";

const { publish, deliver, attendance, followUp } = EDU_ACTIONS;
const HOURS = 3_600_000;
const MIDTERM_BREAK = { start: "2025-10-27", end: "2025-10-31" };
const CANCELED = new Set(["2025-11-13", "2025-12-04"]);
const CLUB_DAYS = ["2025-12-20", "2026-01-03", "2026-01-10"];
const TERM_TWO_DAYS = ["2026-01-13", "2026-01-15"];
const FACILITATORS = ["facilitator.wren", "facilitator.sage", "facilitator.moss"] as const;

const at = (day: DayKey, hour: number, minute: number) =>
  instantAt(day, hour, minute, LEARNING_ZONE.utcOffsetMinutes);

function termOneDays(): DayKey[] {
  return eachDay("2025-09-16", "2025-12-11").filter((day) => {
    const weekday = weekdayIndex(day);
    const inBreak = day >= MIDTERM_BREAK.start && day <= MIDTERM_BREAK.end;
    return (weekday === 1 || weekday === 3) && !inBreak;
  });
}

interface Session {
  day: DayKey;
  facilitator: string;
  club: boolean;
}

function sessionRecords(session: Session, random: Random): WorkRecord[] {
  const { day, facilitator, club } = session;
  const siteChance = club ? 0.6 : 0.7;
  const place = club ? "community-hall" : "upper-terrace";
  const records: WorkRecord[] = [];
  const shared = (id: string, submittedAt: number) => ({
    id,
    submittedAt,
    decision: "pending" as const,
    approvalReadable: true,
    photoCount: between(random, 1, 3),
  });

  records.push({
    ...shared(
      `hilltop-${day}-plan`,
      at(weekStartOf(club ? addDays(day, -5) : day), 8, between(random, 0, 50))
    ),
    actionId: publish,
    accountId: facilitator,
    title: club ? "Reading club" : "Soil science session",
    quantities: { plannedDurationMin: club ? 60 : 75, capacity: club ? 12 : 30 },
    minutes: 20,
    media: "edu",
  });
  if (CANCELED.has(day)) return records;

  const late = random() < 0.15;
  const deliveredAt = at(day, between(random, 15, 17), between(random, 0, 59));
  records.push({
    ...shared(
      `hilltop-${day}-session`,
      late ? deliveredAt + between(random, 20, 60) * HOURS : deliveredAt
    ),
    actionId: deliver,
    accountId: facilitator,
    title: club ? "Reading club" : "Soil science session",
    sentFromDeviceAt: late ? deliveredAt : undefined,
    performedOn: random() < 0.7 ? day : undefined,
    quantities: {
      deliveredDurationMin: club ? 60 : between(random, 50, 90),
      facilitators: between(random, 1, 2),
    },
    minutes: club ? 75 : between(random, 70, 120),
    siteId: random() < siteChance ? place : undefined,
    media: club ? "banner" : "edu",
  });

  if (!club && random() < 0.1) return records;
  const attendees = club ? between(random, 6, 10) : between(random, 12, 26);
  const band = random() < 0.4 ? (attendees > 15 ? "16-30" : "6-15") : null;
  records.push({
    ...shared(`hilltop-${day}-attendance`, deliveredAt + between(random, 1, 3) * 900_000),
    actionId: attendance,
    accountId: club ? facilitator : "classroom-tablet",
    title: club ? "Reading club sign-in" : "Session sign-in sheet",
    quantities: { attendees },
    quantityNote: band ? `Unique attendee estimate: ${band}` : undefined,
    minutes: 10,
    siteId: club ? undefined : place,
    media: "edu",
  });
  return records;
}

function followUpRecords(random: Random): WorkRecord[] {
  return eachDay("2025-09-19", "2025-12-12")
    .filter((day) => weekdayIndex(day) === 4 && random() < 0.35)
    .map((day) => ({
      id: `hilltop-${day}-follow-up`,
      actionId: followUp,
      accountId: "facilitator.moss",
      title: "Seed swap follow-up",
      submittedAt: at(day, between(random, 10, 13), between(random, 0, 59)),
      decision: "pending" as const,
      approvalReadable: true,
      quantities: {},
      minutes: between(random, 30, 60),
      siteId: random() < 0.5 ? "seed-library" : undefined,
      media: "agro" as const,
      photoCount: 1,
    }));
}

/** One steward reviews on Fridays; after Dec 19 nobody has reviewed. */
const FRIDAY_REVIEW: ReviewPlan = {
  reviewers: ["steward.elm"],
  rejectRate: 0.04,
  reviewDay: (submitted) => {
    const friday = nextReviewDay(submitted, (day) => weekdayIndex(day) === 4, 7);
    return friday && friday <= "2025-12-19" ? friday : null;
  },
};

export function learningRecords(): WorkRecord[] {
  const random = createRandom(5_303);
  const reviewRandom = createRandom(909);
  const sessions: Session[] = [
    ...termOneDays().map((day, index) => ({
      day,
      facilitator: FACILITATORS[index % 3],
      club: false,
    })),
    ...CLUB_DAYS.map((day) => ({ day, facilitator: "facilitator.sage", club: true })),
    ...TERM_TWO_DAYS.map((day, index) => ({ day, facilitator: FACILITATORS[index], club: false })),
  ];
  const records = [
    ...sessions.flatMap((session) => sessionRecords(session, random)),
    ...followUpRecords(random),
  ];
  return records
    .filter((record) => record.submittedAt < LAB_REFERENCE_MS)
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((record) =>
      applyReview({
        record,
        plan: FRIDAY_REVIEW,
        random: reviewRandom,
        reference: LAB_REFERENCE_MS,
        ...LEARNING_ZONE,
      })
    );
}
