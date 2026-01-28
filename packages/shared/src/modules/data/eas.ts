import { getEASConfig } from "../../config/blockchain";
import { easGraphQL } from "./graphql";
import { createEasClient } from "./graphql-client";
import { resolveIPFSUrl } from "./ipfs";
import type {
  EASAttestationRaw,
  EASDecodedField,
  EASGardenAssessment,
  EASWork,
  EASWorkApproval,
} from "../../types/eas-responses";

const GATEWAY_BASE_URL = "https://w3s.link";

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
 * Value that can be converted to a number from EAS decoded fields
 * Handles various formats: number, bigint, hex string, or nested value objects
 */
type NumberConvertibleValue =
  | number
  | bigint
  | string
  | { hex: string }
  | { value: NumberConvertibleValue }
  | null
  | undefined;

/**
 * Converts various EAS field value formats to a number.
 * Handles: raw numbers, bigints, hex strings, and nested value objects.
 */
const toNumberFromField = (value: NumberConvertibleValue): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      try {
        return Number(BigInt(value));
      } catch {
        return null;
      }
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "object") {
    if ("hex" in value && typeof value.hex === "string") {
      try {
        return Number(BigInt(value.hex));
      } catch {
        return null;
      }
    }
    if ("value" in value) {
      return toNumberFromField(value.value);
    }
  }
  return null;
};

const parseDataToGardenAssessment = (
  gardenAssessmentUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: string | EASDecodedField[]
): EASGardenAssessment => {
  const fields: EASDecodedField[] = Array.isArray(decodedDataJson)
    ? decodedDataJson
    : JSON.parse(decodedDataJson ?? "[]");
  const findField = (name: string) => fields.find((field) => field.name === name);
  const readValue = (name: string): unknown => findField(name)?.value?.value;
  const readString = (name: string): string => (readValue(name) as string) ?? "";
  const readStringArray = (name: string): string[] => (readValue(name) as string[]) ?? [];

  const title = readString("title");
  const description = readString("description");
  const assessmentType = readString("assessmentType");
  const capitals = readStringArray("capitals");
  const metricsCid: string | null = (readValue("metricsJSON") as string) ?? null;
  const evidenceMediaHashes = readStringArray("evidenceMedia");
  const reportDocumentsRaw = readStringArray("reportDocuments");
  const impactAttestationsRaw = readStringArray("impactAttestations");
  const startDateRaw = readValue("startDate") as NumberConvertibleValue;
  const endDateRaw = readValue("endDate") as NumberConvertibleValue;
  const location = readString("location");
  const tags = readStringArray("tags");

  const startDate = toNumberFromField(startDateRaw);
  const endDate = toNumberFromField(endDateRaw);

  return {
    id: gardenAssessmentUID,
    authorAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    title,
    description,
    assessmentType,
    capitals,
    metricsCid,
    metrics: null, // Consumers should fetch this separately
    evidenceMedia: evidenceMediaHashes, // Return hashes only
    reportDocuments: reportDocumentsRaw, // Return hashes only
    impactAttestations: impactAttestationsRaw,
    startDate,
    endDate,
    location,
    tags,
    createdAt: attestation.time,
  };
};

const parseDataToWork = (
  workUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: string
): EASWork => {
  const data: EASDecodedField[] = JSON.parse(decodedDataJson);

  // Safely extract media with error handling
  const mediaData = data.find((d) => d.name === "media");
  const mediaCIDs: string[] = (mediaData?.value?.value as string[]) || [];

  // Resolve IPFS CIDs to gateway URLs
  const media = mediaCIDs.map((cid: string) => resolveIPFSUrl(cid, GATEWAY_BASE_URL));

  // Safely extract optional fields with null handling
  const feedbackData = data.find((d) => d.name === "feedback");
  const metadataData = data.find((d) => d.name === "metadata");
  const titleData = data.find((d) => d.name === "title");
  const actionUIDData = data.find((d) => d.name === "actionUID");

  // Handle actionUID which can be a number, hex string, or object with hex property
  const actionUIDValue = actionUIDData?.value?.value as NumberConvertibleValue;
  const actionUIDHex = actionUIDData?.value?.hex as string | undefined;
  const actionUID = toNumberFromField(actionUIDHex ?? actionUIDValue) ?? 0;

  return {
    id: workUID,
    gardenerAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    actionUID,
    title: (titleData?.value?.value as string) || "Untitled Work",
    feedback: (feedbackData?.value?.value as string) || "",
    metadata: (metadataData?.value?.value as string) || "",
    media, // Now returns proper gateway URLs
    createdAt: attestation.time,
  };
};

const parseDataToWorkApproval = (
  workApprovalUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: string
): EASWorkApproval => {
  const data: EASDecodedField[] = JSON.parse(decodedDataJson);

  // Helper to find field by name
  const findField = (name: string) => data.find((d) => d.name === name);

  // Safely extract fields with null/undefined handling
  const feedbackData = findField("feedback");
  const actionUIDData = findField("actionUID");
  const workUIDData = findField("workUID");
  const approvedData = findField("approved");

  const actionUIDValue = actionUIDData?.value?.value as NumberConvertibleValue;

  // Parse approved field robustly - handle boolean, string, or number
  const rawApproved = approvedData?.value?.value;
  let approved = false;
  if (typeof rawApproved === "boolean") {
    approved = rawApproved;
  } else if (typeof rawApproved === "string") {
    approved = rawApproved.toLowerCase() === "true" || rawApproved === "1";
  } else if (typeof rawApproved === "number") {
    approved = rawApproved !== 0;
  }

  return {
    id: workApprovalUID,
    operatorAddress: attestation.attester,
    gardenerAddress: attestation.recipient,
    actionUID: toNumberFromField(actionUIDValue) ?? 0,
    workUID: (workUIDData?.value?.value as string) || "",
    approved,
    feedback: (feedbackData?.value?.value as string) || "",
    createdAt: attestation.time,
  };
};

/** Fetches garden assessment attestations from EAS */
export const getGardenAssessments = async (
  gardenAddress?: string,
  chainId?: number | string
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

  const easConfig = getEASConfig(chainId);
  const schemaId = { equals: easConfig.GARDEN_ASSESSMENT.uid };
  const client = createEasClient(chainId);

  const { data, error } = await client.query(
    QUERY,
    {
      where: gardenAddress
        ? {
            schemaId,
            recipient: { equals: gardenAddress },
            revoked: { equals: false },
          }
        : {
            schemaId,
            revoked: { equals: false },
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
  chainId?: number | string
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
  const schemaId = { equals: easConfig.WORK.uid };
  const client = createEasClient(chainId);

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

  const { data, error } = await client.query(QUERY, { where }, "getWorks");

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
  chainId?: number | string
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
  const client = createEasClient(chainId);

  const { data, error } = await client.query(
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
  chainId?: number | string
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
  const schemaId = { equals: easConfig.WORK_APPROVAL.uid };
  const client = createEasClient(chainId);

  const { data, error } = await client.query(
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
  chainId?: number | string
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
  const client = createEasClient(chainId);

  const { data, error } = await client.query(
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
  chainId?: number | string
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
  const client = createEasClient(chainId);

  const { data, error } = await client.query(
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
