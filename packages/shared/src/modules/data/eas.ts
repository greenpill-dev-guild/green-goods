import { getEASConfig } from "../../config/blockchain";
import { easGraphQL } from "./graphql";
import { resolveIPFSUrl } from "./pinata";
import { createEasClient } from "./urql";

const GATEWAY_BASE_URL = "https://w3s.link";

const toNumberFromField = (value: any): number | null => {
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
  decodedDataJson: any
): any => {
  const fields = Array.isArray(decodedDataJson)
    ? decodedDataJson
    : JSON.parse(decodedDataJson ?? "[]");
  const findField = (name: string) => fields.find((field: any) => field.name === name);
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
  decodedDataJson: any
): any => {
  const data = JSON.parse(decodedDataJson);

  // Safely extract media with error handling
  const mediaData = data.find((d: any) => d.name === "media");
  const mediaCIDs: string[] = mediaData?.value?.value || [];

  // Resolve IPFS CIDs to gateway URLs
  const media = mediaCIDs.map((cid: string) => resolveIPFSUrl(cid, GATEWAY_BASE_URL));

  // Safely extract optional fields with null handling
  const feedbackData = data.find((d: any) => d.name === "feedback");
  const metadataData = data.find((d: any) => d.name === "metadata");
  const titleData = data.find((d: any) => d.name === "title");
  const actionUIDData = data.find((d: any) => d.name === "actionUID");

  return {
    id: workUID,
    gardenerAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    actionUID: Number(actionUIDData?.value?.value?.hex || actionUIDData?.value?.value || 0),
    title: titleData?.value?.value || "Untitled Work",
    feedback: feedbackData?.value?.value || "",
    metadata: metadataData?.value?.value || "",
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
  decodedDataJson: any
): any => {
  const data = JSON.parse(decodedDataJson);

  // Safely extract feedback with null/undefined handling
  const feedbackData = data.find((d: any) => d.name === "feedback");
  const feedback = feedbackData?.value?.value || "";

  return {
    id: workApprovalUID,
    operatorAddress: attestation.attester,
    gardenerAddress: attestation.recipient,
    actionUID: data.filter((d: any) => d.name === "actionUID")[0].value.value!,
    workUID: data.filter((d: any) => d.name === "workUID")[0].value.value!,
    approved: data.filter((d: any) => d.name === "approved")[0].value.value!,
    feedback: feedback,
    createdAt: attestation.time,
  };
};

/** Fetches garden assessment attestations from EAS */
export const getGardenAssessments = async (
  gardenAddress?: string,
  chainId?: number | string
): Promise<any[]> => {
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
): Promise<any[]> => {
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

  const works = Promise.all(
    data?.attestations.map(async ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWork(id, { attester, recipient, time: timeCreated }, decodedDataJson)
    ) ?? []
  );

  return works;
};

/** Retrieves work attestations submitted by a specific gardener */
export const getWorksByGardener = async (
  gardenerAddress?: string,
  chainId?: number | string
): Promise<any[]> => {
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

  return await Promise.all(
    (data.attestations || []).map(
      async ({ id, attester, recipient, timeCreated, decodedDataJson }: any) =>
        parseDataToWork(id, { attester, recipient, time: timeCreated }, decodedDataJson)
    )
  );
};

/** Loads work approval attestations */
export const getWorkApprovals = async (
  gardenerAddress?: string,
  chainId?: number | string
): Promise<any[]> => {
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
