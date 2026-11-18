/**
 * Garden reporting lab: deterministic tools the two synthetic gardens share.
 *
 * Every record comes from a seeded generator, so the sample reads the same on every
 * render, in tests and in Storybook. The reference moment is the Storybook clock.
 */
import { addDays, type DayKey, dayKeyOf, instantAt, weekdayIndex } from "./dates";
import type { ReviewDecision, WorkRecord } from "./model";

/** The lab's fixed "now": 16 Jan 2026, 00:00 UTC, the same instant Storybook freezes. */
export const LAB_REFERENCE_MS = Date.UTC(2026, 0, 16);

export type Random = () => number;

/** mulberry32: small, fast and the same everywhere. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** An integer from `min` to `max`, both included. */
export function between(random: Random, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

/** Picks by weight: `[["a", 3], ["b", 1]]` returns "a" three times as often. */
export function pickWeighted<T>(random: Random, weighted: ReadonlyArray<readonly [T, number]>): T {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of weighted) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return weighted[weighted.length - 1][0];
}

export function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export interface ReviewPlan {
  /** Days a steward reviews, given the day the work arrived; null when nobody reviews it in time. */
  reviewDay: (submittedDay: DayKey, random: Random) => DayKey | null;
  reviewers: readonly string[];
  /** Chance a decision rejects; work with a missing quantity is rejected more often. */
  rejectRate: number;
}

/** The next day on or after `day` that `isReviewDay` accepts, within `limit` days. */
export function nextReviewDay(day: DayKey, isReviewDay: (day: DayKey) => boolean, limit = 40) {
  for (let offset = 0; offset <= limit; offset += 1) {
    const candidate = addDays(day, offset);
    if (isReviewDay(candidate)) return candidate;
  }
  return null;
}

export function isWeekday(day: DayKey) {
  return weekdayIndex(day) < 5;
}

const REJECTION_REASONS = [
  "The photo doesn't show the sorted piles. Please add one.",
  "The weight is missing. Add the scale reading and send it again.",
  "This looks like the same batch as yesterday's record.",
  "The receipt is unreadable in the photo.",
] as const;

interface ReviewContext {
  record: WorkRecord;
  plan: ReviewPlan;
  random: Random;
  reference: number;
  timeZone: string;
  utcOffsetMinutes: number;
}

/**
 * Settles one record against a review plan: a decision before the reference moment
 * keeps its time and reviewer, and anything later is still pending.
 */
export function applyReview({
  record,
  plan,
  random,
  reference,
  timeZone,
  utcOffsetMinutes,
}: ReviewContext): WorkRecord {
  const submittedDay = dayKeyOf(record.submittedAt, timeZone);
  const reviewDay = plan.reviewDay(submittedDay, random);
  if (!reviewDay) return { ...record, decision: "pending" };
  let reviewedAt = instantAt(
    reviewDay,
    between(random, 16, 20),
    between(random, 0, 59),
    utcOffsetMinutes
  );
  if (reviewedAt <= record.submittedAt)
    reviewedAt = record.submittedAt + between(random, 2, 6) * 3_600_000;
  if (reviewedAt >= reference) return { ...record, decision: "pending" };
  const missingQuantity = Object.values(record.quantities).some((value) => value === null);
  const rejectChance = missingQuantity ? 0.45 : plan.rejectRate;
  const decision: ReviewDecision = random() < rejectChance ? "rejected" : "approved";
  return {
    ...record,
    decision,
    reviewedAt,
    reviewerId: pick(random, plan.reviewers),
    confidence:
      decision === "approved" ? pick(random, ["Medium", "High", "High"] as const) : undefined,
    method:
      decision === "approved" ? pick(random, ["Photos", "Photos and onsite visit"]) : undefined,
    feedback: decision === "rejected" ? pick(random, REJECTION_REASONS) : undefined,
  };
}
