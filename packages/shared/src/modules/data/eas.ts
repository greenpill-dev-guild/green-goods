import { getEASConfig } from "../../config/blockchain";
import { easGraphQL } from "./graphql";
import { resolveIPFSUrl } from "./pinata";
import { createEasClient } from "./urql";

const GATEWAY_BASE_URL = "https://w3s.link";

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
  const readValue = (name: string) => findField(name)?.value?.value;

  const title = readValue("title") ?? "";
  const description = readValue("description") ?? "";
  const assessmentType = readValue("assessmentType") ?? "";
  const capitals = (readValue("capitals") as string[]) ?? [];
  const metricsCid: string | null = readValue("metricsJSON") ?? null;
  const evidenceMediaHashes = (readValue("evidenceMedia") as string[]) ?? [];
  const reportDocumentsRaw = (readValue("reportDocuments") as string[]) ?? [];
  const impactAttestationsRaw = (readValue("impactAttestations") as string[]) ?? [];
  const startDateRaw = readValue("startDate");
  const endDateRaw = readValue("endDate");
  const location = readValue("location") ?? "";
  const tags = (readValue("tags") as string[]) ?? [];

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
  const actionUIDValue = actionUIDData?.value?.value;
  const actionUIDHex = actionUIDData?.value?.hex;
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

  return {
    id: workApprovalUID,
    operatorAddress: attestation.attester,
    gardenerAddress: attestation.recipient,
    actionUID: toNumberFromField(actionUIDData?.value?.value as NumberConvertibleValue) ?? 0,
    workUID: (workUIDData?.value?.value as string) || "",
    approved: (approvedData?.value?.value as boolean) ?? false,
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

  const { data, error } = await client
    .query(QUERY, {
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
    })
    .toPromise();

  if (error) console.error(error);
  if (!data) console.error("No assessment data found");

  return (
    data?.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) => {
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
    }) ?? []
  );
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

  const { data, error } = await client.query(QUERY, { where }).toPromise();

  if (error) console.error(error);
  if (!data) console.error("No data found");

  return (
    data?.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWork(id, { attester, recipient, time: timeCreated }, decodedDataJson)
    ) ?? []
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

  const { data, error } = await client
    .query(QUERY, {
      where: {
        schemaId: { equals: easConfig.WORK.uid },
        attester: { equals: gardenerAddress },
        revoked: { equals: false },
      },
    })
    .toPromise();

  if (error) {
    console.error(error);
    return [];
  }
  if (!data) {
    console.error("No data found");
    return [];
  }

  return (data.attestations || []).map(
    ({ id, attester, recipient, timeCreated, decodedDataJson }: EASAttestationRaw) =>
      parseDataToWork(id, { attester, recipient, time: timeCreated as number }, decodedDataJson)
  );
};

/** Loads work approval attestations */
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

  const { data, error } = await client
    .query(QUERY, {
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
    })
    .toPromise();

  if (error) console.error(error);
  if (!data) console.error("No data found");

  return (
    data?.attestations.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWorkApproval(id, { attester, recipient, time: timeCreated }, decodedDataJson)
    ) ?? []
  );
};
