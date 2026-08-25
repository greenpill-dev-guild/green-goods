import { getEASConfig } from "../../config/blockchain";
import type {
  EASAttestationRaw,
  EASGardenAssessment,
  EASWork,
  EASWorkApproval,
} from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";
import { parseDataToGardenAssessment, parseDataToWork, parseDataToWorkApproval } from "./eas-parse";
export { parseWorkApprovalAttestation } from "./eas-parse";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

/** Custom error for EAS fetch failures - allows React Query to properly retry/error */
export class EASFetchError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "EASFetchError";
  }
}

/**
 * Garden assessment attestations under one schema: the v2 UID by default, or
 * the v3 registration (`getEASConfig().ASSESSMENT_V3`) when `schemaUID` names it.
 */
export const getGardenAssessments = async (
  gardenAddress?: string,
  chainId?: number | string,
  schemaUID?: string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASGardenAssessment[]> => {
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

  const resolvedSchemaUID = schemaUID ?? getEASConfig(chainId).ASSESSMENT.uid;
  if (isZeroBytes32(resolvedSchemaUID)) return [];

  const schemaId = { equals: resolvedSchemaUID };
  const { data, error } = await reader.query(
    QUERY,
    {
      where: {
        schemaId,
        revoked: { equals: false },
        ...(gardenAddress ? { recipient: { equals: gardenAddress } } : {}),
      },
    },
    "getGardenAssessments"
  );

  if (error) {
    throw new EASFetchError(
      `Failed to fetch garden assessments: ${error.message}`,
      "getGardenAssessments",
      error
    );
  }

  if (!data?.attestations) {
    return [];
  }

  return data.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) => {
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

  const schemaId = { equals: easConfig.WORK.uid };
  // Handle both single address and array of addresses
  let recipientCondition;
  if (Array.isArray(gardenAddress)) {
    if (gardenAddress.length > 0) {
      recipientCondition = { in: gardenAddress };
    }
  } else if (gardenAddress) {
    recipientCondition = { equals: gardenAddress };
  }

  const where = {
    schemaId,
    revoked: { equals: false },
    ...(recipientCondition ? { recipient: recipientCondition } : {}),
  };

  const { data, error } = await reader.query(QUERY, { where }, "getWorks");

  if (error) {
    throw new EASFetchError(`Failed to fetch works: ${error.message}`, "getWorks", error);
  }

  if (!data?.attestations) {
    // No attestations is valid (empty garden) - return empty array
    return [];
  }

  return data.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWork(id, { attester, recipient, time: timeCreated }, decodedDataJson)
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
        attester: { equals: gardenerAddress },
        revoked: { equals: false },
      },
    },
    "getWorksByGardener"
  );

  if (error) {
    throw new EASFetchError(
      `Failed to fetch works by gardener: ${error.message}`,
      "getWorksByGardener",
      error
    );
  }

  if (!data?.attestations) {
    return [];
  }

  return data.attestations.map(
    ({ id, attester, recipient, timeCreated, decodedDataJson }: EASAttestationRaw) =>
      parseDataToWork(id, { attester, recipient, time: timeCreated as number }, decodedDataJson)
  );
};

/**
 * Loads work approval attestations.
 *
 * SCALABILITY NOTE: Currently fetches all approvals matching the schema.
 * Client-side filtering by workUID does not scale as attestation volume grows.
 *
 * TODO: When implementing pagination:
 * - Add optional `page`/`limit` or `cursor` parameters
 * - Update queryKey in consumers to include pagination params
 * - Consider a backend aggregation endpoint that accepts specific workUIDs
 *   and returns only matching approvals for better performance.
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

  const schemaId = { equals: easConfig.WORK_APPROVAL.uid };
  const { data, error } = await reader.query(
    QUERY,
    {
      where: gardenerAddress
        ? {
            schemaId,
            recipient: { equals: gardenerAddress },
            revoked: { equals: false },
          }
        : {
            schemaId,
            revoked: { equals: false },
          },
    },
    "getWorkApprovals"
  );

  if (error) {
    throw new EASFetchError(
      `Failed to fetch work approvals: ${error.message}`,
      "getWorkApprovals",
      error
    );
  }

  if (!data?.attestations) {
    return [];
  }

  return data.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWorkApproval(id, { attester, recipient, time: timeCreated }, decodedDataJson)
  );
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

  if (!data?.attestations) {
    return [];
  }

  return data.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWorkApproval(id, { attester, recipient, time: timeCreated }, decodedDataJson)
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

  if (!data?.attestations) {
    return [];
  }

  return data.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWork(id, { attester, recipient, time: timeCreated }, decodedDataJson)
  );
};
