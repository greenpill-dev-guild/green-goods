import type { EASWorkApproval, EASWorkListRow } from "../../types/eas-responses";
import { logger } from "../app/logger";
import { getWorkListPage, readWorkApprovalsForWorks, WORK_LIST_PAGE_SIZE } from "../data/eas";

export { WORK_LIST_PAGE_SIZE } from "../data/eas";

export interface ReadWorkListOptions {
  garden: string;
  chainId: number;
  /** How many of the newest works to read; the screen widens this when asked for older work. */
  take?: number;
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
    const candidates = byWork.get(key) ?? [];
    const latestTime = Math.max(...candidates.map((approval) => approval.createdAt ?? 0), 0);
    const latest = candidates.filter((approval) => (approval.createdAt ?? 0) === latestTime);
    // Conflicting decisions in the same timestamp bucket have no execution
    // order in EAS GraphQL. Preserve the last known status instead of choosing
    // an arbitrary approval or rejection.
    if (new Set(latest.map((approval) => approval.approved)).size > 1) return work;
    return {
      ...work,
      approval: latest.sort((left, right) => left.id.localeCompare(right.id)).at(-1) ?? null,
    };
  });
}
