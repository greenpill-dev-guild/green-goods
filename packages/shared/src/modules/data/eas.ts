import { getEASConfig } from "../../config/blockchain";
import type {
  EASAttestationRaw,
  EASGardenAssessment,
  EASWork,
  EASWorkApproval,
} from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { getAssessmentSchemas } from "../assessment/schemas";
import { parseDataToGardenAssessment, parseDataToWork, parseDataToWorkApproval } from "./eas-parse";

export { parseWorkApprovalAttestation } from "./eas-parse";

import { EASFetchError, easStoredAddress, validatedAttestations } from "./eas-read-validation";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

export { EASFetchError } from "./eas-read-validation";
export {
  getWorkApprovalsForWorks,
  getWorkListPage,
  readWorkApprovalsForWorks,
  WORK_LIST_PAGE_SIZE,
} from "./eas-work-list";

const EAS_PAGE_SIZE = 100;

type AttestationPageResult =
  | { data: { attestations?: unknown }; error?: undefined }
  | { data?: undefined; error: Error };

async function readAllAttestations(
  readPage: (take: number, skip: number) => Promise<AttestationPageResult>,
  operation: string,
  label: string
): Promise<EASAttestationRaw[]> {
  const attestations: EASAttestationRaw[] = [];
  for (let skip = 0; ; skip += EAS_PAGE_SIZE) {
    const { data, error } = await readPage(EAS_PAGE_SIZE, skip);
    const page = data?.attestations;
    if (error || !Array.isArray(page)) {
      throw new EASFetchError(
        `Failed to fetch ${label}: ${error?.message ?? "Invalid attestations response"}`,
        operation,
        error
      );
    }
    attestations.push(...validatedAttestations(page, operation));
    if (page.length < EAS_PAGE_SIZE) return attestations;
  }
}

/**
 * Read every registered assessment version unless a caller explicitly narrows the schema.
 */
export const getGardenAssessments = async (
  gardenAddress?: string,
  chainId?: number | string,
  schemaUID?: string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASGardenAssessment[]> => {
  const QUERY = easGraphQL(/* GraphQL */ `
    query Assessments($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
      attestations(where: $where, take: $take, skip: $skip, orderBy: [{ id: asc }]) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);

  const schemas =
    schemaUID === undefined
      ? getAssessmentSchemas(getEASConfig(chainId)).map((schema) => schema.uid)
      : [schemaUID].filter((uid) => !isZeroBytes32(uid));
  if (schemas.length === 0) return [];

  const where = {
    schemaId: { in: schemas },
    revoked: { equals: false },
    ...(gardenAddress ? { recipient: { equals: easStoredAddress(gardenAddress) } } : {}),
  };
  const pageSize = 100;
  const attestations: EASAttestationRaw[] = [];
  // EAS defaults to one page. A stable unique order lets every schema's history
  // be read without one version filling the page and hiding another.
  for (let skip = 0; ; skip += pageSize) {
    const { data, error } = await reader.query(
      QUERY,
      { where, take: pageSize, skip },
      "getGardenAssessments"
    );

    if (error || !Array.isArray(data?.attestations)) {
      throw new EASFetchError(
        `Failed to fetch garden assessments: ${error?.message ?? "Invalid attestations response"}`,
        "getGardenAssessments",
        error
      );
    }

    attestations.push(...validatedAttestations(data.attestations, "getGardenAssessments"));
    // Count raw rows: skipping malformed records must not end pagination early.
    if (data.attestations.length < pageSize) break;
  }

  return attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) => {
    const timestamp = typeof timeCreated === "string" ? Number(timeCreated) : (timeCreated ?? 0);
    return parseDataToGardenAssessment(
      id,
      {
        attester,
        recipient,
        time: timestamp,
      },
      decodedDataJson
    );
  });
};

/** Queries work attestations for a garden or multiple gardens */
export const getWorks = async (
  gardenAddress?: string | string[],
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWork[]> => {
  const QUERY = easGraphQL(/* GraphQL */ `
    query Attestations($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
      attestations(where: $where, take: $take, skip: $skip, orderBy: [{ id: asc }]) {
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

  const schemaId = { equals: easConfig.WORK.uid };
  // Handle both single address and array of addresses
  let recipientCondition;
  if (Array.isArray(gardenAddress)) {
    if (gardenAddress.length > 0) {
      recipientCondition = { in: gardenAddress.map(easStoredAddress) };
    }
  } else if (gardenAddress) {
    recipientCondition = { equals: easStoredAddress(gardenAddress) };
  }

  const where = {
    schemaId,
    revoked: { equals: false },
    ...(recipientCondition ? { recipient: recipientCondition } : {}),
  };

  const attestations = await readAllAttestations(
    (take, skip) => reader.query(QUERY, { where, take, skip }, "getWorks"),
    "getWorks",
    "works"
  );
  return attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWork(id, { attester, recipient, time: Number(timeCreated) }, decodedDataJson)
  );
};

/** Retrieves work attestations submitted by a specific gardener */
export const getWorksByGardener = async (
  gardenerAddress?: string,
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWork[]> => {
  if (!gardenerAddress) return [];

  const QUERY = easGraphQL(/* GraphQL */ `
    query Attestations($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
      attestations(where: $where, take: $take, skip: $skip, orderBy: [{ id: asc }]) {
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

  const attestations = await readAllAttestations(
    (take, skip) =>
      reader.query(
        QUERY,
        {
          where: {
            schemaId: { equals: easConfig.WORK.uid },
            attester: { equals: easStoredAddress(gardenerAddress) },
            revoked: { equals: false },
          },
          take,
          skip,
        },
        "getWorksByGardener"
      ),
    "getWorksByGardener",
    "works by gardener"
  );
  return attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWork(id, { attester, recipient, time: Number(timeCreated) }, decodedDataJson)
  );
};

/**
 * Loads work approval attestations.
 *
 * Reads every approval page. Callers that need approvals for one known work
 * should use getWorkApprovalsForWork so they do not load the full history.
 *
 * @param gardenerAddress - Optional filter by recipient address (gardener)
 * @param chainId - Optional chain ID override
 * @returns Array of work approval attestations
 */
export const getWorkApprovals = async (
  gardenerAddress?: string,
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWorkApproval[]> => {
  const QUERY = easGraphQL(/* GraphQL */ `
    query Attestations($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
      attestations(where: $where, take: $take, skip: $skip, orderBy: [{ id: asc }]) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);

  const easConfig = getEASConfig(chainId);
  if (isZeroBytes32(easConfig.WORK_APPROVAL.uid)) return [];

  const schemaId = { equals: easConfig.WORK_APPROVAL.uid };
  const where = gardenerAddress
    ? {
        schemaId,
        recipient: { equals: easStoredAddress(gardenerAddress) },
        revoked: { equals: false },
      }
    : {
        schemaId,
        revoked: { equals: false },
      };
  const attestations = await readAllAttestations(
    (take, skip) => reader.query(QUERY, { where, take, skip }, "getWorkApprovals"),
    "getWorkApprovals",
    "work approvals"
  );
  return attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWorkApproval(id, { attester, recipient, time: Number(timeCreated) }, decodedDataJson)
  );
};

/**
 * Loads the bounded candidate set for one exact Work UID. Recipient is
 * deliberately not constrained: current approvals target the garden while
 * historical bot approvals targeted the gardener.
 */
export const getWorkApprovalsForWork = async (
  workUID: string,
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWorkApproval[]> => {
  const QUERY = easGraphQL(/* GraphQL */ `
    query WorkApprovalsForWork($where: AttestationWhereInput) {
      attestations(where: $where) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);
  const easConfig = getEASConfig(chainId);
  if (isZeroBytes32(easConfig.WORK_APPROVAL.uid)) return [];
  const { data, error } = await reader.query(
    QUERY,
    {
      where: {
        schemaId: { equals: easConfig.WORK_APPROVAL.uid },
        decodedDataJson: { contains: workUID },
        revoked: { equals: false },
      },
    },
    "getWorkApprovalsForWork"
  );
  if (error) {
    throw new EASFetchError(
      `Failed to fetch Work approval candidates: ${error.message}`,
      "getWorkApprovalsForWork",
      error
    );
  }
  if (!Array.isArray(data?.attestations)) {
    throw new EASFetchError(
      "Failed to fetch Work approval candidates: Invalid attestations response",
      "getWorkApprovalsForWork"
    );
  }
  return validatedAttestations(data.attestations, "getWorkApprovalsForWork")
    .map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWorkApproval(
        id,
        { attester, recipient, time: Number(timeCreated) },
        decodedDataJson
      )
    )
    .filter((approval) => approval.workUID.toLowerCase() === workUID.toLowerCase());
};

/**
 * Fetches work approval attestations by their UIDs.
 * More efficient than getWorkApprovals when you have specific UIDs to fetch.
 *
 * @param uids - Array of attestation UIDs to fetch
 * @param chainId - Optional chain ID override
 * @returns Array of work approval attestations matching the UIDs
 */
export const getWorkApprovalsByUIDs = async (
  uids: string[],
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWorkApproval[]> => {
  if (uids.length === 0) return [];

  const QUERY = easGraphQL(/* GraphQL */ `
    query Attestations($where: AttestationWhereInput) {
      attestations(where: $where) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);

  const easConfig = getEASConfig(chainId);
  if (isZeroBytes32(easConfig.WORK_APPROVAL.uid)) return [];

  const { data, error } = await reader.query(
    QUERY,
    {
      where: {
        schemaId: { equals: easConfig.WORK_APPROVAL.uid },
        id: { in: uids },
        revoked: { equals: false },
      },
    },
    "getWorkApprovalsByUIDs"
  );

  if (error) {
    throw new EASFetchError(
      `Failed to fetch work approvals by UIDs: ${error.message}`,
      "getWorkApprovalsByUIDs",
      error
    );
  }

  if (!Array.isArray(data?.attestations))
    throw new EASFetchError(
      "Failed to fetch work approvals by UIDs: Invalid attestations response",
      "getWorkApprovalsByUIDs"
    );

  return validatedAttestations(data.attestations, "getWorkApprovalsByUIDs").map(
    ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWorkApproval(
        id,
        { attester, recipient, time: Number(timeCreated) },
        decodedDataJson
      )
  );
};

/**
 * Fetches work attestations by their UIDs.
 * More efficient than getWorks when you have specific UIDs to fetch.
 *
 * @param uids - Array of attestation UIDs to fetch
 * @param chainId - Optional chain ID override
 * @returns Array of work attestations matching the UIDs
 */
export const getWorksByUIDs = async (
  uids: string[],
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWork[]> => {
  if (uids.length === 0) return [];

  const QUERY = easGraphQL(/* GraphQL */ `
    query Attestations($where: AttestationWhereInput) {
      attestations(where: $where) {
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
        id: { in: uids },
        revoked: { equals: false },
      },
    },
    "getWorksByUIDs"
  );

  if (error) {
    throw new EASFetchError(
      `Failed to fetch works by UIDs: ${error.message}`,
      "getWorksByUIDs",
      error
    );
  }

  if (!Array.isArray(data?.attestations))
    throw new EASFetchError(
      "Failed to fetch works by UIDs: Invalid attestations response",
      "getWorksByUIDs"
    );

  return validatedAttestations(data.attestations, "getWorksByUIDs").map(
    ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWork(id, { attester, recipient, time: Number(timeCreated) }, decodedDataJson)
  );
};
