import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { EASWork, EASWorkApproval, EASWorkListRow } from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { logger } from "../app/logger";
import { isWorkVisible, readWorkVisibility, type WorkVisibilitySnapshot } from "./work-visibility";
import {
  getGardenActivitySince,
  getWorkApprovalsForWork,
  getWorkListPage,
  getWorksByUIDs,
  getWorksInRange,
  readWorkApprovalsForWorks,
  WORK_LIST_PAGE_SIZE,
} from "../data/eas";

export { WORK_LIST_PAGE_SIZE } from "../data/eas";

export interface ReadWorkListOptions {
  garden: string;
  chainId: number;
  /** How many of the newest works to read; the screen widens this when asked for older work. */
  take?: number;
  visibility?: WorkVisibilitySnapshot;
}

/**
 * A work with its latest decision: the one that stands, since a decision is changed by attesting
 * a new one. Conflicting decisions in one timestamp leave the work undecided.
 */
export function withLatestApproval(work: EASWork, approvals: EASWorkApproval[]): EASWorkListRow {
  const latestTime = Math.max(...approvals.map((approval) => approval.createdAt ?? 0), 0);
  const latest = approvals.filter((approval) => (approval.createdAt ?? 0) === latestTime);
  // Conflicting decisions in the same timestamp bucket have no execution order.
  if (new Set(latest.map((approval) => approval.approved)).size > 1) return work;
  return {
    ...work,
    approval: latest.sort((left, right) => left.id.localeCompare(right.id)).at(-1) ?? null,
  };
}

/** Read an older work directly when it is outside the garden list's loaded page. */
export async function readWorkByUID(
  uid: string,
  chainId: number,
  visibility?: WorkVisibilitySnapshot
): Promise<EASWorkListRow | null> {
  if (!isWorkVisible(uid, visibility ?? (await readWorkVisibility(chainId)))) return null;
  const work = (await getWorksByUIDs([uid], chainId))[0];
  if (!work) return null;
  try {
    return withLatestApproval(work, await getWorkApprovalsForWork(work.id, chainId));
  } catch (error) {
    logger.warn("[readWorkByUID] Approval status could not be read", { error });
    return work;
  }
}

/**
 * Garden reads that may wait on EAS at once. A steward's review count and the
 * Work Dashboard read every garden they review together, and that burst made
 * each read slow enough to time out. A read waits for its turn before it asks
 * EAS, so the wait does not count against its own timeout.
 */
const WORK_LIST_READS_AT_ONCE = 2;
let readsInFlight = 0;
const waitingReads: Array<() => void> = [];

async function inTurn<T>(read: () => Promise<T>): Promise<T> {
  if (readsInFlight < WORK_LIST_READS_AT_ONCE) readsInFlight += 1;
  else await new Promise<void>((resolve) => waitingReads.push(resolve));
  try {
    return await read();
  } finally {
    // The next waiting read takes this turn over; with none waiting, it is free.
    const next = waitingReads.shift();
    if (next) next();
    else readsInFlight -= 1;
  }
}

/**
 * The garden screen's read: the newest works of one garden with their latest
 * approval attached. Background preparation reads the same thing, so a garden
 * browsed online is already prepared. When the approvals read fails the works
 * still come back, with their approval unknown rather than missing.
 */
export function readWorkList(options: ReadWorkListOptions): Promise<EASWorkListRow[]> {
  return inTurn(() => readGardenWorkList(options));
}

async function readGardenWorkList({
  garden,
  chainId,
  take = WORK_LIST_PAGE_SIZE,
  visibility,
}: ReadWorkListOptions): Promise<EASWorkListRow[]> {
  const exclusions = visibility ?? (await readWorkVisibility(chainId));
  const works = await getWorkListPage(garden, { ...exclusions, chainId, take });
  if (works.length === 0) return [];
  let approvals: EASWorkApproval[];
  let failedWorkUIDs = new Set<string>();
  try {
    const result = await readWorkApprovalsForWorks(
      works.map((work) => work.id),
      chainId
    );
    approvals = result.approvals;
    failedWorkUIDs = new Set(result.failedWorkUIDs.map((uid) => uid.toLowerCase()));
    if (failedWorkUIDs.size > 0) {
      logger.warn("[readWorkList] Some approval batches could not be read", {
        garden,
        failedWorkCount: failedWorkUIDs.size,
      });
    }
  } catch (error) {
    logger.warn("[readWorkList] Approvals could not be read; works keep their last known status", {
      error,
      garden,
    });
    return works;
  }
  const byWork = groupByWork(approvals);
  return works.map((work) => {
    const key = work.id.toLowerCase();
    if (failedWorkUIDs.has(key)) return work;
    return withLatestApproval(work, byWork.get(key) ?? []);
  });
}

/** A garden's works that changed since a moment, each with its latest decision. */
export interface GardenActivity {
  rows: EASWorkListRow[];
  /**
   * Every work and decision of the window was read. False when a list ran past its limit or
   * the older works its decisions name could not be read.
   */
  complete: boolean;
}

/**
 * The works that changed in a garden since a moment, however far back each was submitted: the
 * works submitted since then, and the older works decided since then. The garden screen's page
 * holds only the newest works; the bell reads this so a submission or a decision in its window
 * always counts. `since` is in seconds.
 */
export function readGardenActivity({
  garden,
  chainId,
  since,
  visibility,
}: {
  garden: string;
  chainId: number;
  since: number;
  visibility?: WorkVisibilitySnapshot;
}): Promise<GardenActivity> {
  return inTurn(async () => {
    const exclusions = visibility ?? (await readWorkVisibility(chainId));
    const { works, decisions, truncated } = await getGardenActivitySince(garden, {
      ...exclusions,
      chainId,
      since,
    });
    const listed = new Set(works.map((work) => work.id.toLowerCase()));
    const olderIds = [
      ...new Set(
        decisions
          .map((decision) => decision.workUID)
          .filter((uid) => uid && !listed.has(uid.toLowerCase()))
      ),
    ];
    let older: EASWork[] = [];
    let complete = !truncated;
    if (olderIds.length > 0) {
      try {
        older = await getWorksByUIDs(olderIds, chainId);
      } catch (error) {
        logger.warn("[readGardenActivity] Older decided works could not be read", {
          error,
          garden,
        });
        complete = false;
      }
    }
    // A decision on a work submitted in the window came after it, so the window holds all of
    // that work's decisions; an older work's latest decision is in the window too.
    const byWork = groupByWork(decisions);
    const rows = [...works, ...older].map((work) =>
      withLatestApproval(work, byWork.get(work.id.toLowerCase()) ?? [])
    );
    return { rows, complete };
  });
}

/** Every work a garden received in a period, each with its latest decision. */
export interface GardenWorkRange {
  /** Oldest first. A row whose decisions could not be read carries no `approval`. */
  rows: EASWorkListRow[];
  /** False when the period holds more works than one read lists, so some are missing. */
  complete: boolean;
  /**
   * When the read was cut, the moment (seconds) it reached: the period's works after it are
   * missing, and so may be more works at that moment. Null when the period was read in full.
   */
  readThrough: number | null;
  /** When each work left out as malformed was sent (seconds; NaN when that is unreadable too). */
  droppedAt: number[];
}

/**
 * The works submitted to a garden between two moments, however many the garden has received
 * since: what a month or a day of the garden shows. The garden screen's page holds only the
 * newest works, so a period read from it would silently miss the rest. `from` is included,
 * `to` is not; both are in seconds. A status that could not be read stays unknown.
 */
export function readGardenWorkRange({
  garden,
  chainId,
  from,
  to,
  visibility,
}: {
  garden: Address;
  chainId: number;
  from: number;
  to: number;
  visibility?: WorkVisibilitySnapshot;
}): Promise<GardenWorkRange> {
  return inTurn(async () => {
    const exclusions = visibility ?? (await readWorkVisibility(chainId));
    const { works, truncated, readThrough, droppedAt } = await getWorksInRange(garden, {
      ...exclusions,
      chainId,
      from,
      to,
    });
    if (works.length === 0) return { rows: [], complete: !truncated, readThrough, droppedAt };
    let approvals: EASWorkApproval[];
    let unread: Set<string>;
    try {
      const result = await readWorkApprovalsForWorks(
        works.map((work) => work.id),
        chainId
      );
      approvals = result.approvals;
      unread = new Set(result.failedWorkUIDs.map((uid) => uid.toLowerCase()));
    } catch (error) {
      logger.warn("[readGardenWorkRange] Decisions could not be read; statuses stay unknown", {
        error,
        garden,
      });
      return { rows: works, complete: !truncated, readThrough, droppedAt };
    }
    const byWork = groupByWork(approvals);
    return {
      rows: works.map((work) => {
        const key = work.id.toLowerCase();
        return unread.has(key) ? work : withLatestApproval(work, byWork.get(key) ?? []);
      }),
      complete: !truncated,
      readThrough,
      droppedAt,
    };
  });
}

/** A garden's submissions and first decisions over a period, for Review Health's weeks. */
export interface GardenReviewFlow {
  /** Every work submitted in the period, oldest first, each with its latest decision. */
  submitted: EASWorkListRow[];
  /**
   * Every work whose first decision landed in the period, with that moment in seconds. A work
   * decided again later counts once, in the week of its first decision.
   */
  reviewed: { work: EASWorkListRow; firstDecidedAt: number }[];
  /** False when the period held more submissions than one read lists: its latest are missing. */
  submittedComplete: boolean;
  /** When each submission left out as malformed was sent (seconds; NaN when unreadable too). */
  submittedDroppedAt: number[];
  /**
   * When the period's earliest decisions are missing, the moment (seconds) before which they
   * are; null when every decision of the period was read.
   */
  reviewedReadFrom: number | null;
  /** False when a decided work's decisions could not all be read, so some may be misplaced. */
  reviewedComplete: boolean;
  /** False on a chain that records no review decisions: reviewed counts do not exist there. */
  reviewedAvailable: boolean;
  /**
   * Works this device decided, confirmed on chain, that the index holds no decision for yet:
   * each is a first decision that landed just now.
   */
  decidedUnindexed: EASWorkListRow[];
}

const unique = (ids: readonly string[]) => [...new Set(ids.map((id) => id.toLowerCase()))];

/**
 * What a garden received and what it reviewed since `from` (seconds): the submissions of the
 * period, as a calendar month reads them, and each work whose first decision fell in it,
 * however long before the period it was sent. A decision's own read lists the newest first,
 * so past its limit the period's earliest decisions are the missing ones.
 *
 * The reads follow one another, and work can be sent or decided between them. The activity
 * read comes after the range read, so a work it lists that the range read missed was sent in
 * between; and every decided work's history is read last, so its status there is the newest.
 * `decidedHere` names works this device decided and saw confirmed, which the index may not
 * hold yet.
 */
export async function readGardenReviewFlow({
  garden,
  chainId,
  from,
  to,
  visibility,
  decidedHere = [],
}: {
  garden: Address;
  chainId: number;
  from: number;
  to: number;
  visibility?: WorkVisibilitySnapshot;
  decidedHere?: readonly string[];
}): Promise<GardenReviewFlow> {
  const exclusions = visibility ?? (await readWorkVisibility(chainId));
  const range = await readGardenWorkRange({ garden, chainId, from, to, visibility: exclusions });
  const reviewedAvailable = !isZeroBytes32(getEASConfig(chainId).WORK_APPROVAL.uid);
  return inTurn(async () => {
    // A second before the period, since the read lists decisions after its moment, not at it.
    const {
      works: recent,
      decisions,
      decisionsTruncated,
      decisionsDropped,
    } = await getGardenActivitySince(garden, {
      ...exclusions,
      chainId,
      since: from - 1,
    });
    const listed = new Map<string, EASWorkListRow>(
      range.rows.map((row) => [row.id.toLowerCase(), row])
    );
    // Sent after the range read. Only beside a whole range read: past a cut, a later work
    // would hide where the read stopped.
    const sentSince = range.complete
      ? recent.filter(
          (work) =>
            work.createdAt >= from && work.createdAt < to && !listed.has(work.id.toLowerCase())
        )
      : [];
    const decidedIds = unique(decisions.map((decision) => decision.workUID));
    const localIds = unique(decidedHere).filter((id) => !decidedIds.includes(id));
    // Only a cut decisions list hides decisions; a long submissions list beside it does not.
    const reviewedReadFrom =
      decisionsTruncated && decisions.length > 0
        ? Math.min(...decisions.map((decision) => decision.createdAt))
        : null;

    // Each history read here, by work; a work whose history could not be read has none.
    const histories = new Map<string, EASWorkApproval[]>();
    let reviewedComplete = !decisionsDropped;
    const historyIds = unique([...decidedIds, ...localIds, ...sentSince.map((work) => work.id)]);
    if (reviewedAvailable && historyIds.length > 0) {
      try {
        const result = await readWorkApprovalsForWorks(historyIds, chainId);
        const failed = new Set(result.failedWorkUIDs.map((uid) => uid.toLowerCase()));
        const byWork = groupByWork(result.approvals);
        for (const id of historyIds) if (!failed.has(id)) histories.set(id, byWork.get(id) ?? []);
        // A decision row that could not be read leaves its week's reviewed count short.
        reviewedComplete = reviewedComplete && failed.size === 0 && result.dropped === 0;
      } catch (error) {
        logger.warn("[readGardenReviewFlow] Decision histories could not be read", {
          error,
          garden,
        });
        reviewedComplete = false;
      }
    }
    // A history read after the range read is the newer status.
    const restate = (row: EASWork | EASWorkListRow): EASWorkListRow => {
      // A chain with no decision schema can hold no decision, as the range read reads it.
      const history = reviewedAvailable ? histories.get(row.id.toLowerCase()) : [];
      if (!history) return row;
      const { approval: _earlier, ...work } = row as EASWorkListRow;
      return withLatestApproval(work, history);
    };
    const submitted = [...range.rows, ...sentSince]
      .map(restate)
      .sort((left, right) => left.createdAt - right.createdAt);
    for (const row of submitted) listed.set(row.id.toLowerCase(), row);

    const olderIds = [...decidedIds, ...localIds].filter(
      (id) =>
        !listed.has(id) &&
        histories.has(id) &&
        ((histories.get(id)?.length ?? 0) > 0 || localIds.includes(id))
    );
    if (olderIds.length > 0) {
      try {
        for (const work of await getWorksByUIDs(olderIds, chainId)) {
          listed.set(work.id.toLowerCase(), restate(work));
        }
      } catch (error) {
        logger.warn("[readGardenReviewFlow] Older decided works could not be read", {
          error,
          garden,
        });
        reviewedComplete = false;
      }
    }

    const reviewed: GardenReviewFlow["reviewed"] = [];
    const decidedUnindexed: EASWorkListRow[] = [];
    for (const id of [...decidedIds, ...localIds]) {
      const history = histories.get(id);
      const work = listed.get(id);
      if (!history || !work) continue;
      if (history.length === 0) {
        if (localIds.includes(id)) decidedUnindexed.push(work);
        continue;
      }
      const firstDecidedAt = Math.min(...history.map((approval) => approval.createdAt));
      if (firstDecidedAt >= from && firstDecidedAt < to) reviewed.push({ work, firstDecidedAt });
    }
    reviewed.sort((left, right) => left.firstDecidedAt - right.firstDecidedAt);
    return {
      submitted,
      reviewed,
      submittedComplete: range.complete,
      submittedDroppedAt: range.droppedAt,
      reviewedReadFrom,
      reviewedComplete,
      reviewedAvailable,
      decidedUnindexed,
    };
  });
}

/** Approved works, and whether unread decisions may be hiding more. */
export interface ApprovedWorks {
  works: EASWork[];
  /** Some decisions could not be read, so approved work may be missing from `works`. */
  partial: boolean;
}

/**
 * The works whose latest decision approved them, for surfaces that show only
 * approved work, such as the public website. A work is left out when it has
 * no decision, when its latest decision rejected it, or when its latest
 * decisions disagree. It is also left out when its decisions could not be
 * read, and `partial` then says approved work may be missing. A chain with no
 * decision schema can record no decision, so there approval is unknown, not
 * "none".
 */
export async function readApprovedWorks(works: EASWork[], chainId: number): Promise<ApprovedWorks> {
  if (works.length === 0) return { works: [], partial: false };
  if (isZeroBytes32(getEASConfig(chainId).WORK_APPROVAL.uid)) return { works: [], partial: true };
  let approvals: EASWorkApproval[];
  let unread: Set<string>;
  try {
    const result = await readWorkApprovalsForWorks(
      works.map((work) => work.id),
      chainId
    );
    approvals = result.approvals;
    unread = new Set(result.failedWorkUIDs.map((uid) => uid.toLowerCase()));
  } catch (error) {
    logger.warn("[readApprovedWorks] Decisions could not be read; no work counts as approved", {
      error,
    });
    return { works: [], partial: true };
  }
  if (unread.size > 0) {
    logger.warn("[readApprovedWorks] Some decisions could not be read; their works are left out", {
      unreadWorkCount: unread.size,
    });
  }
  const byWork = groupByWork(approvals);
  return {
    works: works.filter((work) => {
      const key = work.id.toLowerCase();
      if (unread.has(key)) return false;
      return withLatestApproval(work, byWork.get(key) ?? []).approval?.approved === true;
    }),
    partial: unread.size > 0,
  };
}

function groupByWork(approvals: EASWorkApproval[]): Map<string, EASWorkApproval[]> {
  const byWork = new Map<string, EASWorkApproval[]>();
  for (const approval of approvals) {
    const key = approval.workUID.toLowerCase();
    byWork.set(key, [...(byWork.get(key) ?? []), approval]);
  }
  return byWork;
}
