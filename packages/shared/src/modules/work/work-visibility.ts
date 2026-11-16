import { getEASConfig } from "../../config/blockchain";
import {
  publicRehearsalCycles,
  publicReviewedWorkExclusionIds,
} from "../../config/public-record-visibility";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import type { PublicReportingRead } from "../commitment-pooling/public-record-exclusions";
import { parseDataToWorkApproval } from "../data/eas-parse";
import { EASFetchError, validatedAttestations } from "../data/eas-read-validation";
import { easGraphQL } from "../data/graphql";
import type { GraphQLReader } from "../data/graphql-client";

/** Presentation policy only. Raw attestation and settlement reads keep their full history. */
export interface WorkVisibilitySnapshot {
  chainId: number;
  excludedWorkUIDs: string[];
  excludedApprovalUIDs: string[];
}

export function hasWorkVisibilityExclusions(chainId: number): boolean {
  return (
    publicReviewedWorkExclusionIds(chainId).length > 0 || publicRehearsalCycles(chainId).length > 0
  );
}

export function isWorkVisible(uid: string, visibility: WorkVisibilitySnapshot): boolean {
  return !visibility.excludedWorkUIDs.includes(uid.toLowerCase());
}

const APPROVALS = easGraphQL(/* GraphQL */ `
  query WorkVisibilityApprovals($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
    attestations(where: $where, take: $take, skip: $skip, orderBy: [{ id: asc }]) {
      id
      attester
      recipient
      timeCreated
      decodedDataJson
    }
  }
`);

/**
 * One serializable snapshot for lists, counts, details and prepared offline views. Exact
 * approval IDs let EAS exclude decisions before its pagination and aggregate counts too.
 * A failed classification is unavailable, never an empty exclusion list.
 */
export async function readWorkVisibility(
  chainId: number,
  dependencies: { reporting?: PublicReportingRead; reader?: GraphQLReader } = {}
): Promise<WorkVisibilitySnapshot> {
  const visibility: WorkVisibilitySnapshot = {
    chainId,
    excludedWorkUIDs: [],
    excludedApprovalUIDs: [],
  };
  if (!hasWorkVisibilityExclusions(chainId)) return visibility;
  const reporting =
    dependencies.reporting ??
    (await import("../commitment-pooling/public-record-exclusions")).createPublicReportingRead(
      chainId
    );
  const links = await reporting.links();
  visibility.excludedWorkUIDs = [...links.workUIDs].map((uid) => uid.toLowerCase());
  const schema = getEASConfig(chainId).WORK_APPROVAL.uid;
  if (visibility.excludedWorkUIDs.length === 0 || isZeroBytes32(schema)) return visibility;
  const reader =
    dependencies.reader ?? (await import("../data/graphql-client")).createEasClient(chainId);
  const deadline = AbortSignal.timeout(30000);
  const approvalUIDs = new Set<string>();
  for (let start = 0; start < visibility.excludedWorkUIDs.length; start += 50) {
    const batch = visibility.excludedWorkUIDs.slice(start, start + 50);
    for (let skip = 0; ; skip += 100) {
      deadline.throwIfAborted();
      const { data, error } = await reader.query(
        APPROVALS,
        {
          where: {
            schemaId: { equals: schema },
            revoked: { equals: false },
            OR: batch.map((uid) => ({ decodedDataJson: { contains: uid } })),
          },
          take: 100,
          skip,
        },
        "readWorkVisibilityApprovals",
        deadline
      );
      if (error || !Array.isArray(data?.attestations)) {
        throw new EASFetchError("Work visibility could not be read", "readWorkVisibility", error);
      }
      const rows = validatedAttestations(data.attestations, "readWorkVisibility");
      if (rows.length !== data.attestations.length) {
        throw new EASFetchError("Work visibility is incomplete", "readWorkVisibility");
      }
      for (const row of rows) {
        const approval = parseDataToWorkApproval(
          row.id,
          { attester: row.attester, recipient: row.recipient, time: Number(row.timeCreated) },
          row.decodedDataJson
        );
        if (!approval.workUID) {
          throw new EASFetchError("Work visibility is incomplete", "readWorkVisibility");
        }
        if (!isWorkVisible(approval.workUID, visibility)) approvalUIDs.add(row.id.toLowerCase());
      }
      if (data.attestations.length < 100) break;
    }
  }
  visibility.excludedApprovalUIDs = [...approvalUIDs];
  return visibility;
}
