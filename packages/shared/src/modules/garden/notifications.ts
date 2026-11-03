/**
 * Garden notifications: what is new for an account in one garden, the events behind the bell
 * in Home's header (PWA Home decision 11 as amended on 21 October, DL-130). Each event is one
 * row, derived from read models the garden already has, so nothing is written to produce it:
 *
 * - For every member: their work approved, or rejected with the review's feedback (the
 *   garden's work list), and a promise of theirs taken up (the commitments in its pool).
 * - For an account that can act on it, under the predicate that gates the act on the phone: a
 *   new submission for whoever may approve the garden's work (the work page's
 *   `canManageGarden`: the garden's stewards and owners), and a take-up request on an
 *   approval-gated promise for whoever may accept or decline it (the claim panel's
 *   `stewardsPoolGarden`, a live chain read of the pool's stewards and owners). Each is listed
 *   while it still waits and never to the account that made it. An evaluator or a gardener
 *   gets neither (decision 22).
 * - For whoever answers join requests in the Gardeners sheet (`canManageGarden` again), one
 *   event while requests wait (PRD-1381). The agent holds the requests, and a browser reads only
 *   their count, with the grant a signed check of the queue left in it, so the event names
 *   nobody and the device dates it (`noteJoinRequestsWaiting`). A member hears nothing when their
 *   own request is answered: reading it takes their signature.
 *
 * Seen state is a device record per chain, account and garden (`gardenNotificationsScope`):
 * the events the member was shown, by id, and a time at or before which everything counts as
 * seen. Marking by id keeps an event that was indexed late new, even when a newer one has
 * already been seen. Only the last week's events can be new, on a device that has never marked
 * a garden's events and on one that marked them long ago.
 */

import type {
  CommitmentClaimRequestRecord,
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "../commitment-pooling/types-core";
import type { Work } from "../../types/domain";
import { compareAddresses } from "../../utils/blockchain/address";

/** One event for the bell. `at` is when it happened, in seconds; `id` holds from read to read. */
export type GardenNotification =
  /** The account's own work, approved. `at` is when the review was indexed. */
  | { kind: "workApproved"; id: string; at: number; work: Work }
  /** The account's own work, rejected. The review's feedback is `work.reviewFeedback`. */
  | { kind: "workRejected"; id: string; at: number; work: Work }
  /** A promise the account made, taken up by someone else. `at` is the acceptance. */
  | { kind: "promiseTakenUp"; id: string; at: number; commitment: CommitmentReadModel }
  /** Someone else's work, waiting for review. `at` is when it was submitted. */
  | { kind: "workSubmitted"; id: string; at: number; work: Work }
  /** Someone asks to take up an approval-gated promise. `at` is when they asked. */
  | {
      kind: "takeUpRequested";
      id: string;
      at: number;
      commitment: CommitmentReadModel;
      claim: CommitmentClaimRequestRecord;
    }
  /**
   * Join requests wait in the garden, `waiting` of them. `at` is when this device first read the
   * count at that height (`JoinRequestsRead`), so each rise is a new event and an answer is not.
   */
  | { kind: "joinRequested"; id: string; at: number; waiting: number };

/**
 * A garden's join-request queue as one device last read its count. A count names nobody, so an
 * answer and a new request between two reads cancel out, and the device dates what it reads.
 */
export interface JoinRequestsRead {
  /** How many waited at the last read. */
  waiting: number;
  /** When this device first read the count at that height or above, in seconds. */
  since: number;
}

export interface GardenNotificationSources {
  /** The signed-in account. */
  account: string;
  /** Whether the account may approve the garden's work on the phone (`canManageGarden`). */
  canReviewWork: boolean;
  /** Whether the account may accept or decline take-up requests (`stewardsPoolGarden`). */
  canDecideTakeUps: boolean;
  /** The garden's works: its page and the week's activity, each with its latest decision. */
  works: readonly Work[];
  /** The commitments in the garden's pool. */
  commitments: readonly CommitmentReadModel[];
  /**
   * The take-up requests in the garden's pool, each with its promise (`usePoolClaimRequests`).
   * Only an approval-gated promise holds a pending one: the contract accepts an Open one at
   * once (`ClaimsLib.requestClaim`).
   */
  takeUpRequests: readonly PoolClaimRequestRow[];
  /**
   * The garden's join-request queue while requests wait, for an account that may answer them.
   * Left out without a count grant in this browser, or with nothing waiting.
   */
  joinRequests?: JoinRequestsRead;
}

/** How far back an event can still be new: a week, in seconds. */
export const NEW_NOTIFICATION_WINDOW_SECONDS = 7 * 24 * 60 * 60;

/** What one device has seen of one garden's events, for one account. */
export interface GardenNotificationsSeen {
  /** Events at or before this time, in seconds, count as seen. */
  seenThrough: number;
  /** The events after `seenThrough` the member was shown: each id with the event's time. */
  seen: Record<string, number>;
  /**
   * The events the member cleared from the sheet on this device (DL-133), by id, with when.
   * Never trimmed with the week: an older event the garden's page still lists would come back.
   */
  cleared?: Record<string, number>;
}

/** What seen state needs of an event. */
export type SeenNotification = Pick<GardenNotification, "id" | "at">;

/** The garden's events for the account, newest first. */
export function deriveGardenNotifications(
  sources: GardenNotificationSources
): GardenNotification[] {
  const isAccount = (address: string | null | undefined) =>
    compareAddresses(address, sources.account);
  const notifications: GardenNotification[] = [];

  for (const work of sources.works) {
    if (isAccount(work.gardenerAddress)) {
      // A decision only this device knows has no review time yet; it is news once indexed.
      const at = work.reviewedAt;
      if (!at) continue;
      const id = `review:${work.id}:${at}`;
      if (work.status === "approved") notifications.push({ kind: "workApproved", id, at, work });
      if (work.status === "rejected") notifications.push({ kind: "workRejected", id, at, work });
    } else if (sources.canReviewWork && work.status === "pending") {
      notifications.push({
        kind: "workSubmitted",
        id: `submission:${work.id}`,
        at: work.createdAt,
        work,
      });
    }
  }

  // The contract refuses a creator as their own taker (`SelfCounterparty`), so whoever took a
  // promise up is someone else.
  for (const commitment of sources.commitments) {
    const at = commitment.acceptanceAt;
    if (!at || !isAccount(commitment.creator)) continue;
    notifications.push({
      kind: "promiseTakenUp",
      id: `takenUp:${commitment.id}:${at}`,
      at,
      commitment,
    });
  }

  if (sources.canDecideTakeUps) {
    for (const { claim, commitment } of sources.takeUpRequests) {
      if (claim.state !== "PENDING" || isAccount(claim.claimant) || isAccount(claim.requestedBy)) {
        continue;
      }
      // After a decline the same person may ask again under the same id; the time tells them apart.
      notifications.push({
        kind: "takeUpRequested",
        id: `takeUp:${claim.id}:${claim.requestedAt}`,
        at: claim.requestedAt,
        commitment,
        claim,
      });
    }
  }

  if (sources.joinRequests) {
    const { waiting, since } = sources.joinRequests;
    notifications.push({ kind: "joinRequested", id: `joinRequests:${since}`, at: since, waiting });
  }

  return notifications.sort((left, right) => right.at - left.at || left.id.localeCompare(right.id));
}

/**
 * Whether this device has yet to show the member an event. `now` is in seconds. An event older
 * than the window never counts as new, however long ago the record was last written.
 */
export function isNotificationNew(
  notification: SeenNotification,
  record: GardenNotificationsSeen | undefined,
  now: number
): boolean {
  const cutoff = Math.max(record?.seenThrough ?? 0, now - NEW_NOTIFICATION_WINDOW_SECONDS);
  return notification.at > cutoff && !(record && Object.hasOwn(record.seen, notification.id));
}

/**
 * The record after the member was shown these events. Marks older than the window go, since
 * everything there counts as seen anyway, so the record stays the size of a week of events.
 */
export function markNotificationsSeen(
  record: GardenNotificationsSeen | undefined,
  notifications: readonly SeenNotification[],
  now: number
): GardenNotificationsSeen {
  const seenThrough = Math.max(record?.seenThrough ?? 0, now - NEW_NOTIFICATION_WINDOW_SECONDS);
  const seen: Record<string, number> = {};
  for (const [id, at] of Object.entries(record?.seen ?? {})) if (at > seenThrough) seen[id] = at;
  for (const { id, at } of notifications) if (at > seenThrough) seen[id] = at;
  return record?.cleared ? { seenThrough, seen, cleared: record.cleared } : { seenThrough, seen };
}

/**
 * The queue's record after a read found `waiting` requests, `now` in seconds. A rise dates it
 * `now`, since someone asked after the last read, and always past the last date, so each rise has
 * an id of its own; a fall keeps its date, since an answer brings nobody new; an empty queue ends
 * it. The same record comes back when nothing moved.
 */
export function noteJoinRequestsWaiting(
  record: JoinRequestsRead | undefined,
  waiting: number,
  now: number
): JoinRequestsRead | undefined {
  if (waiting <= 0) return undefined;
  if (!record) return { waiting, since: now };
  if (waiting > record.waiting) return { waiting, since: Math.max(now, record.since + 1) };
  return waiting === record.waiting ? record : { waiting, since: record.since };
}

/** Whether this device has cleared an event from the bell's sheet (DL-133). */
export function isNotificationCleared(
  notification: SeenNotification,
  record: GardenNotificationsSeen | undefined
): boolean {
  return Boolean(record?.cleared && Object.hasOwn(record.cleared, notification.id));
}

/**
 * The record after the member cleared these events on this device (DL-133): each counts as
 * seen and stays out of the sheet. A later event is new and listed as before.
 */
export function clearNotifications(
  record: GardenNotificationsSeen | undefined,
  notifications: readonly SeenNotification[],
  now: number
): GardenNotificationsSeen {
  const seen = markNotificationsSeen(record, notifications, now);
  const cleared: Record<string, number> = { ...(record?.cleared ?? {}) };
  for (const { id } of notifications) cleared[id] = now;
  return { ...seen, cleared };
}

/** The scope a seen record belongs to: `${chainId}:${account}:${garden}`, null without either. */
export function gardenNotificationsScope(
  chainId: number,
  account: string | null | undefined,
  gardenId: string | null | undefined
): string | null {
  return account && gardenId
    ? `${chainId}:${account.toLowerCase()}:${gardenId.toLowerCase()}`
    : null;
}
