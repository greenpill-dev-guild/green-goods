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

function withLatestApproval(work: EASWork, approvals: EASWorkApproval[]): EASWorkListRow {
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
    const { works, truncated } = await getWorksInRange(garden, {
      ...exclusions,
      chainId,
      from,
      to,
    });
    if (works.length === 0) return { rows: [], complete: !truncated };
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
      return { rows: works, complete: !truncated };
    }
    const byWork = groupByWork(approvals);
    return {
      rows: works.map((work) => {
        const key = work.id.toLowerCase();
        return unread.has(key) ? work : withLatestApproval(work, byWork.get(key) ?? []);
      }),
      complete: !truncated,
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
