import type { EASWork, EASWorkApproval, EASWorkListRow } from "../../types/eas-responses";
import { logger } from "../app/logger";
import {
  getWorkApprovalsForWork,
  getWorkListPage,
  getWorksByUIDs,
  readWorkApprovalsForWorks,
  WORK_LIST_PAGE_SIZE,
} from "../data/eas";

export { WORK_LIST_PAGE_SIZE } from "../data/eas";

export interface ReadWorkListOptions {
  garden: string;
  chainId: number;
  /** How many of the newest works to read; the screen widens this when asked for older work. */
  take?: number;
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
export async function readWorkByUID(uid: string, chainId: number): Promise<EASWorkListRow | null> {
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
 * The garden screen's read: the newest works of one garden with their latest
 * approval attached. Background preparation reads the same thing, so a garden
 * browsed online is already prepared. When the approvals read fails the works
 * still come back, with their approval unknown rather than missing.
 */
export async function readWorkList({
  garden,
  chainId,
  take = WORK_LIST_PAGE_SIZE,
}: ReadWorkListOptions): Promise<EASWorkListRow[]> {
  const works = await getWorkListPage(garden, { chainId, take });
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
  const byWork = new Map<string, EASWorkApproval[]>();
  for (const approval of approvals) {
    const key = approval.workUID.toLowerCase();
    byWork.set(key, [...(byWork.get(key) ?? []), approval]);
  }
  return works.map((work) => {
    const key = work.id.toLowerCase();
    if (failedWorkUIDs.has(key)) return work;
    return withLatestApproval(work, byWork.get(key) ?? []);
  });
}
