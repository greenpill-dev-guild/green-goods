/**
 * The garden screen's paged work read.
 *
 * Reading a garden used to mean every work attestation it ever had, plus a
 * second query for every approval on the chain, joined in memory. This is the
 * bounded replacement: one page of the newest works, and the approvals for
 * exactly those works. It lives beside `eas.ts` rather than inside it because
 * it is the only read shaped by what one screen shows at a time.
 *
 * @module modules/data/eas-work-list
 */

import { getEASConfig } from "../../config/blockchain";
import type { EASWork, EASWorkApproval } from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { parseDataToWork, parseDataToWorkApproval } from "./eas-parse";
import { EASFetchError, easStoredAddress, validatedAttestations } from "./eas-read-validation";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

/** Cards a garden screen shows at once; older work is asked for explicitly. */
export const WORK_LIST_PAGE_SIZE = 50;

/**
 * The newest works of one garden, the way the garden screen reads them: one
 * bounded request, newest first, instead of the whole history.
 */
export const getWorkListPage = async (
  gardenAddress: string,
  options: { chainId?: number | string; take?: number; skip?: number } = {},
  reader: GraphQLReader = createEasClient(options.chainId)
): Promise<EASWork[]> => {
  const { chainId, take = WORK_LIST_PAGE_SIZE, skip = 0 } = options;
  const QUERY = easGraphQL(/* GraphQL */ `
    query WorkListPage($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
      attestations(
        where: $where
        take: $take
        skip: $skip
        orderBy: [{ timeCreated: desc }, { id: asc }]
      ) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);
  const easConfig = getEASConfig(chainId);
  if (isZeroBytes32(easConfig.WORK.uid)) return [];
  const { data, error } = await reader.query(
    QUERY,
    {
      where: {
        schemaId: { equals: easConfig.WORK.uid },
        revoked: { equals: false },
        recipient: { equals: easStoredAddress(gardenAddress) },
      },
      take,
      skip,
    },
    "getWorkListPage"
  );
  if (error || !Array.isArray(data?.attestations)) {
    throw new EASFetchError(
      `Failed to fetch work list: ${error?.message ?? "Invalid attestations response"}`,
      "getWorkListPage",
      error
    );
  }
  return validatedAttestations(data.attestations, "getWorkListPage").map(
    ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWork(id, { attester, recipient, time: Number(timeCreated) }, decodedDataJson)
  );
};

/** The most works, and the most decisions, one activity read lists. */
const GARDEN_ACTIVITY_LIMIT = 200;

export interface GardenActivityPage {
  /** Works submitted to the garden since the moment, newest first. */
  works: EASWork[];
  /** Decisions given on the garden's works since the moment, newest first. */
  decisions: EASWorkApproval[];
  /** Either list ran past the limit, so earlier entries of the window are missing. */
  truncated: boolean;
}

/**
 * What happened in one garden since a moment, in one bounded request: the works submitted to
 * it and the decisions given on its works, however far back each decided work was submitted.
 * Decisions are found by garden: the approval resolver refuses a decision whose recipient is
 * not its work's garden. `since` is in seconds.
 */
export const getGardenActivitySince = async (
  gardenAddress: string,
  options: { chainId?: number | string; since: number; take?: number },
  reader: GraphQLReader = createEasClient(options.chainId)
): Promise<GardenActivityPage> => {
  const { chainId, since, take = GARDEN_ACTIVITY_LIMIT } = options;
  const QUERY = easGraphQL(/* GraphQL */ `
    query GardenActivity(
      $works: AttestationWhereInput
      $decisions: AttestationWhereInput
      $take: Int!
    ) {
      works: attestations(where: $works, orderBy: [{ timeCreated: desc }, { id: asc }], take: $take) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
      decisions: attestations(
        where: $decisions
        orderBy: [{ timeCreated: desc }, { id: asc }]
        take: $take
      ) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);
  const easConfig = getEASConfig(chainId);
  if (isZeroBytes32(easConfig.WORK.uid)) return { works: [], decisions: [], truncated: false };
  const inWindow = {
    recipient: { equals: easStoredAddress(gardenAddress) },
    revoked: { equals: false },
    timeCreated: { gt: since },
  };
  const { data, error } = await reader.query(
    QUERY,
    {
      works: { schemaId: { equals: easConfig.WORK.uid }, ...inWindow },
      decisions: { schemaId: { equals: easConfig.WORK_APPROVAL.uid }, ...inWindow },
      // The extra row says the window holds more than one read lists.
      take: take + 1,
    },
    "getGardenActivitySince"
  );
  if (error || !Array.isArray(data?.works) || !Array.isArray(data?.decisions)) {
    throw new EASFetchError(
      `Failed to fetch garden activity: ${error?.message ?? "Invalid attestations response"}`,
      "getGardenActivitySince",
      error
    );
  }
  return {
    works: validatedAttestations(data.works.slice(0, take), "getGardenActivitySince").map(
      ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
        parseDataToWork(id, { attester, recipient, time: Number(timeCreated) }, decodedDataJson)
    ),
    decisions: validatedAttestations(data.decisions.slice(0, take), "getGardenActivitySince").map(
      ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
        parseDataToWorkApproval(
          id,
          { attester, recipient, time: Number(timeCreated) },
          decodedDataJson
        )
    ),
    truncated: data.works.length > take || data.decisions.length > take,
  };
};

const APPROVAL_LOOKUP_BATCH = 50;

export interface WorkApprovalReadResult {
  approvals: EASWorkApproval[];
  /** Works whose batch could not be read; absence is unknown rather than pending. */
  failedWorkUIDs: string[];
}

/**
 * Approvals for a known set of works. An approval names its work inside its
 * decoded data, so the lookup matches on that text and then keeps only the
 * approvals whose parsed work id is one of the requested works.
 */
export const readWorkApprovalsForWorks = async (
  workUIDs: string[],
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<WorkApprovalReadResult> => {
  if (workUIDs.length === 0) return { approvals: [], failedWorkUIDs: [] };
  const easConfig = getEASConfig(chainId);
  if (isZeroBytes32(easConfig.WORK_APPROVAL.uid)) {
    return { approvals: [], failedWorkUIDs: [] };
  }
  const QUERY = easGraphQL(/* GraphQL */ `
    query WorkApprovalsForWorks($where: AttestationWhereInput) {
      attestations(where: $where, orderBy: [{ timeCreated: asc }, { id: asc }]) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);
  const wanted = new Set(workUIDs.map((uid) => uid.toLowerCase()));
  const approvals: EASWorkApproval[] = [];
  const failedWorkUIDs: string[] = [];
  for (let start = 0; start < workUIDs.length; start += APPROVAL_LOOKUP_BATCH) {
    const batch = workUIDs.slice(start, start + APPROVAL_LOOKUP_BATCH);
    try {
      const { data, error } = await reader.query(
        QUERY,
        {
          where: {
            schemaId: { equals: easConfig.WORK_APPROVAL.uid },
            revoked: { equals: false },
            OR: batch.map((uid) => ({ decodedDataJson: { contains: uid } })),
          },
        },
        "getWorkApprovalsForWorks"
      );
      if (error || !Array.isArray(data?.attestations)) {
        throw new EASFetchError(
          `Failed to fetch work approvals for works: ${error?.message ?? "Invalid attestations response"}`,
          "getWorkApprovalsForWorks",
          error
        );
      }
      for (const attestation of validatedAttestations(
        data.attestations,
        "getWorkApprovalsForWorks"
      )) {
        const { id, attester, recipient, timeCreated, decodedDataJson } = attestation;
        const approval = parseDataToWorkApproval(
          id,
          { attester, recipient, time: Number(timeCreated) },
          decodedDataJson
        );
        if (wanted.has(approval.workUID.toLowerCase())) approvals.push(approval);
      }
    } catch {
      failedWorkUIDs.push(...batch);
    }
  }
  return { approvals, failedWorkUIDs };
};

/** Strict compatibility read for callers that cannot represent per-work unknown status. */
export const getWorkApprovalsForWorks = async (
  workUIDs: string[],
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWorkApproval[]> => {
  const result = await readWorkApprovalsForWorks(workUIDs, chainId, reader);
  if (result.failedWorkUIDs.length > 0) {
    throw new EASFetchError(
      `Failed to fetch work approvals for ${result.failedWorkUIDs.length} works`,
      "getWorkApprovalsForWorks"
    );
  }
  return result.approvals;
};
