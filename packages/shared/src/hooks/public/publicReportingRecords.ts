import { publicWorkReviewStatus } from "../../config/public-record-visibility";
import {
  createPublicReportingRead,
  publicRehearsalRecordLinks,
  type PublicReportingRead,
} from "../../modules/commitment-pooling/public-record-exclusions";
import { getGardenAssessments } from "../../modules/data/eas";
import { getGardenHypercerts } from "../../modules/data/hypercerts-fetch";
import { readApprovedWorks } from "../../modules/work/work-list";
import type { EASWork } from "../../types/eas-responses";

/** Public eligibility follows explicit review and indexed rehearsal relationships. */
export async function readPublicApprovedWorks(
  works: EASWork[],
  chainId: number,
  reporting: PublicReportingRead = createPublicReportingRead(chainId)
) {
  const eligible = works.filter((work) => publicWorkReviewStatus(work, chainId) === undefined);
  if (eligible.length === 0) return { works: [], partial: false };
  const links = await reporting.links();
  return readApprovedWorks(
    eligible.filter((work) => !links.workUIDs.has(work.id.toLowerCase())),
    chainId
  );
}

export async function getPublicGardenAssessments(
  gardenId: string | undefined,
  chainId: number,
  reporting: PublicReportingRead = createPublicReportingRead(chainId)
) {
  const [assessments, rows] = await Promise.all([
    getGardenAssessments(gardenId, chainId),
    reporting.commitments(),
  ]);
  const { assessmentUIDs } = publicRehearsalRecordLinks(chainId, rows);
  return assessments.filter((assessment) => !assessmentUIDs.has(assessment.id.toLowerCase()));
}

export async function getPublicGardenHypercerts(
  gardenId: string,
  chainId: number,
  limit = 50,
  reporting: PublicReportingRead = createPublicReportingRead(chainId)
) {
  const links = await reporting.links();
  return getGardenHypercerts(gardenId, chainId, undefined, limit, undefined, {
    ...links,
    requireReconciled: true,
  });
}
