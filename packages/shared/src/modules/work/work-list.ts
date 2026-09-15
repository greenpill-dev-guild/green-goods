import type { EASWorkApproval, EASWorkListRow } from "../../types/eas-responses";
import { logger } from "../app/logger";
import { getWorkApprovalsForWorks, getWorkListPage, WORK_LIST_PAGE_SIZE } from "../data/eas";

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
  try {
    approvals = await getWorkApprovalsForWorks(
      works.map((work) => work.id),
      chainId
    );
  } catch (error) {
    logger.warn("[readWorkList] Approvals could not be read; works keep their last known status", {
      error,
      garden,
    });
    return works;
  }
  const latest = new Map<string, EASWorkApproval>();
  for (const approval of [...approvals].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))) {
    latest.set(approval.workUID.toLowerCase(), approval);
  }
  return works.map((work) => ({ ...work, approval: latest.get(work.id.toLowerCase()) ?? null }));
}
