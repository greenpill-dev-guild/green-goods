import { publicWorkReviewStatus } from "../../config/public-record-visibility";
import { readApprovedWorks } from "../../modules/work/work-list";
import type { EASWork } from "../../types/eas-responses";

/** Approval does not establish that an explicitly held record is production work. */
export function readPublicApprovedWorks(works: EASWork[], chainId: number) {
  return readApprovedWorks(
    works.filter((work) => publicWorkReviewStatus(work, chainId) === undefined),
    chainId
  );
}
