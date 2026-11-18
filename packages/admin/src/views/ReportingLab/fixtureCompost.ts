/**
 * Garden reporting lab: Riverbend's synthetic work records, several a day on weekdays,
 * with community cleanups on Saturdays, a holiday lull and a review pause over the holidays.
 */
import { addDays, type DayKey, eachDay, instantAt, weekdayIndex } from "./dates";
import { COMPOST_ZONE, WASTE_ACTIONS } from "./fixtureCompostGarden";
import {
  applyReview,
  between,
  createRandom,
  isWeekday,
  LAB_REFERENCE_MS,
  nextReviewDay,
  pick,
  pickWeighted,
  type Random,
  type ReviewPlan,
  roundTo,
} from "./fixtureTools";
import type { WorkRecord } from "./model";

const { sort, transfer, batch, cleanup, check } = WASTE_ACTIONS;
const HOURS = 3_600_000;
const HOLIDAYS = new Set(["2025-12-25", "2026-01-01"]);
const QUIET_DAYS = new Set(["2025-12-24", "2025-12-26", "2025-12-31"]);
const REVIEW_PAUSE = { start: "2025-12-24", end: "2026-01-04" };

function dailyCount(day: DayKey, random: Random) {
  if (HOLIDAYS.has(day)) return 0;
  const weekday = weekdayIndex(day);
  let count = 0;
  if (weekday < 5) count = between(random, 4, 8);
  else if (weekday === 5) count = between(random, 2, 4);
  else count = random() < 0.3 ? 1 : 0;
  return QUIET_DAYS.has(day) ? Math.min(count, 2) : count;
}

/** One person never shares a location; the others share it by chance. */
function located(random: Random, accountId: string, chance: number) {
  return accountId !== "basalt" && random() < chance;
}

type Draft = Omit<
  WorkRecord,
  "id" | "actionId" | "submittedAt" | "decision" | "approvalReadable" | "photoCount"
>;

function sortDraft(random: Random): Draft {
  const accountId =
    random() < 0.4 ? "tablet" : pick(random, ["kestrel", "juniper", "marigold", "basalt"]);
  const sharesLocation = accountId === "tablet" || located(random, accountId, 0.7);
  return {
    accountId,
    title: "Market gate sort",
    quantities: { totalAmountKg: random() < 0.06 ? null : between(random, 18, 95) },
    minutes: roundTo(between(random, 45, 150), 15),
    siteId: sharesLocation ? "market-gate" : undefined,
    media: "waste",
  };
}

function transferDraft(random: Random): Draft {
  const accountId = pick(random, ["kestrel", "tamarind"]);
  return {
    accountId,
    title: "Recycler run",
    quantities: { amountTransferredKg: roundTo(between(random, 180, 420), 5) },
    minutes: roundTo(between(random, 60, 180), 15),
    siteId: located(random, accountId, 0.9) ? "recycler" : undefined,
    media: "waste",
  };
}

function batchDraft(random: Random): Draft {
  const accountId = pick(random, ["juniper", "marigold", "fennel"]);
  const inputKg = between(random, 40, 120);
  return {
    accountId,
    title: "Compost batch",
    quantities: { inputKg, outputKg: Math.round(inputKg * (0.35 + random() * 0.15)) },
    minutes: roundTo(between(random, 60, 120), 15),
    siteId: located(random, accountId, 0.8) ? "school-bays" : undefined,
    media: "agro",
  };
}

/**
 * A late upload left the device after the work ended (5 PM on the work day) and an hour or
 * more before it reached the chain. It draws one number, as the old offset did, so every
 * later record keeps its values.
 */
function sentAfterWork(performedOn: DayKey, submittedAt: number, random: Random) {
  const workEnded = instantAt(performedOn, 17, 0, COMPOST_ZONE.utcOffsetMinutes);
  const latest = submittedAt - HOURS;
  const earliest = Math.min(workEnded, latest);
  return Math.round(earliest + random() * (latest - earliest));
}

/** Cleanups often upload late from the route, and record the day the event happened. */
function cleanupDraft(day: DayKey, submittedAt: number, random: Random): Draft {
  const accountId = pick(random, ["heron", "fennel", "tamarind", "marigold"]);
  const late = random() < 0.6;
  const durationMin = roundTo(between(random, 60, 180), 15);
  const performedOn = late ? addDays(day, -1) : day;
  return {
    accountId,
    title: "Ward 4 cleanup",
    sentFromDeviceAt: late ? sentAfterWork(performedOn, submittedAt, random) : undefined,
    performedOn,
    quantities: {
      participants: between(random, 6, 22),
      durationMin,
      amountRemoved: between(random, 8, 30),
    },
    quantityNote: "Amount removed has no unit: the action does not ask for one.",
    minutes: durationMin,
    siteId: located(random, accountId, 0.5) ? "ward-4" : undefined,
    media: "banner",
  };
}

function checkDraft(submittedAt: number, random: Random): Draft {
  const accountId = pick(random, ["heron", "fennel", "tamarind", "basalt"]);
  const late = accountId === "heron" && random() < 0.4;
  return {
    accountId,
    title: "Drop-off check",
    sentFromDeviceAt: late ? submittedAt - between(random, 6, 40) * HOURS : undefined,
    quantities: { amountRemoved: between(random, 1, 12) },
    quantityNote: "Amount removed may be kilograms or bags: the action allows both.",
    minutes: roundTo(between(random, 20, 60), 5),
    siteId: located(random, accountId, 0.75)
      ? pick(random, ["river-road", "river-road", "ward-4"])
      : undefined,
    media: "banner",
  };
}

function draftRecord(day: DayKey, index: number, random: Random): WorkRecord {
  const saturday = weekdayIndex(day) === 5;
  const actionId = saturday
    ? pickWeighted(random, [
        [cleanup, 6],
        [sort, 4],
      ])
    : pickWeighted(random, [
        [sort, 50],
        [check, 22],
        [batch, 16],
        [transfer, 12],
      ]);
  const submittedAt = instantAt(
    day,
    between(random, 7, 17),
    between(random, 0, 59),
    COMPOST_ZONE.utcOffsetMinutes
  );
  let draft: Draft;
  if (actionId === sort) draft = sortDraft(random);
  else if (actionId === transfer) draft = transferDraft(random);
  else if (actionId === batch) draft = batchDraft(random);
  else if (actionId === cleanup) draft = cleanupDraft(day, submittedAt, random);
  else draft = checkDraft(submittedAt, random);
  return {
    id: `riverbend-${day}-${index}`,
    actionId,
    submittedAt,
    decision: "pending",
    approvalReadable: true,
    photoCount: between(random, 1, 4),
    ...draft,
  };
}

const reviewsOn = (day: DayKey) =>
  isWeekday(day) && (day < REVIEW_PAUSE.start || day > REVIEW_PAUSE.end);

const TYPICAL_REVIEW: ReviewPlan = {
  reviewers: ["steward.ivy", "steward.oak"],
  rejectRate: 0.05,
  reviewDay: (submitted, random) => {
    const lag = pickWeighted(random, [
      [0, 3],
      [1, 4],
      [2, 2],
      [3, 1],
    ]);
    return nextReviewDay(addDays(submitted, lag), reviewsOn);
  },
};

/** From Dec 22 one steward reviews twice a week with a long lag, so pending work piles up. */
const BACKLOG_REVIEW: ReviewPlan = {
  reviewers: ["steward.ivy"],
  rejectRate: 0.05,
  reviewDay: (submitted, random) =>
    submitted < "2025-12-22"
      ? TYPICAL_REVIEW.reviewDay(submitted, random)
      : nextReviewDay(
          addDays(submitted, between(random, 5, 14)),
          (day) => reviewsOn(day) && [0, 3].includes(weekdayIndex(day))
        ),
};

/**
 * The same submissions in both review plans: the backlog plan changes only who reviews
 * from Dec 22 and how soon, so the two scenarios differ in review, never in work.
 */
export function compostRecords(review: "typical" | "backlog"): WorkRecord[] {
  const random = createRandom(7_101);
  const reviewRandom = createRandom(2_026);
  const plan = review === "typical" ? TYPICAL_REVIEW : BACKLOG_REVIEW;
  const records: WorkRecord[] = [];
  for (const day of eachDay("2025-10-01", "2026-01-15")) {
    const count = dailyCount(day, random);
    for (let index = 0; index < count; index += 1) records.push(draftRecord(day, index, random));
  }
  return records
    .filter((record) => record.submittedAt < LAB_REFERENCE_MS)
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((record) =>
      applyReview({
        record,
        plan,
        random: reviewRandom,
        reference: LAB_REFERENCE_MS,
        ...COMPOST_ZONE,
      })
    );
}
