import { publicWorkReviewStatus } from "../../config/public-record-visibility";
import {
  publicRehearsalRecordLinks,
  readPublicCommitmentExclusions,
} from "../../modules/commitment-pooling/public-record-exclusions";
import { getGardenAssessments } from "../../modules/data/eas";
import { getGardenHypercerts } from "../../modules/data/hypercerts-fetch";
import { readApprovedWorks } from "../../modules/work/work-list";
import type { EASWork } from "../../types/eas-responses";

/** Public eligibility follows explicit review and indexed rehearsal relationships. */
export async function readPublicApprovedWorks(works: EASWork[], chainId: number) {
  const eligible = works.filter((work) => publicWorkReviewStatus(work, chainId) === undefined);
  if (eligible.length === 0) return { works: [], partial: false };
  const links = publicRehearsalRecordLinks(chainId, await readPublicCommitmentExclusions(chainId));
  return readApprovedWorks(
    eligible.filter((work) => !links.workUIDs.has(work.id.toLowerCase())),
    chainId
  );
}

export async function getPublicGardenAssessments(gardenId: string | undefined, chainId: number) {
  const [assessments, rows] = await Promise.all([
    getGardenAssessments(gardenId, chainId),
    readPublicCommitmentExclusions(chainId),
  ]);
  const { assessmentUIDs } = publicRehearsalRecordLinks(chainId, rows);
  return assessments.filter((assessment) => !assessmentUIDs.has(assessment.id.toLowerCase()));
}

export async function getPublicGardenHypercerts(gardenId: string, chainId: number, limit = 50) {
  const links = publicRehearsalRecordLinks(chainId, await readPublicCommitmentExclusions(chainId));
  return getGardenHypercerts(gardenId, chainId, undefined, limit, undefined, {
    ...links,
    requireReconciled: true,
  });
}
