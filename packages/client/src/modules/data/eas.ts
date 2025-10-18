import { getEASConfig } from "@/config/blockchain";

import { easGraphQL } from "./graphql";
import { getFileByHash } from "./pinata";
import { createEasClient } from "./urql";

const PINATA_GATEWAY_BASE =
  import.meta.env.DEV && typeof window !== "undefined"
    ? `${window.location.origin}/pinata/gateway`
    : "https://greengoods.mypinata.cloud";

const toGatewayUrl = (hash?: string) => {
  if (!hash) return "";
  if (hash.startsWith("http")) return hash;
  if (hash.startsWith("ipfs://")) {
    return `${PINATA_GATEWAY_BASE.replace(/\/$/, "")}/ipfs/${hash.replace("ipfs://", "")}`;
  }
  return `${PINATA_GATEWAY_BASE.replace(/\/$/, "")}/ipfs/${hash}`;
};

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

const parseDataToGardenAssessment = async (
  gardenAssessmentUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: any
): Promise<GardenAssessment> => {
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

  let metrics: Record<string, unknown> | null = null;
  if (metricsCid) {
    try {
      const file = await getFileByHash(metricsCid);
      if (file?.data) {
        if (file.data instanceof Blob) {
          const text = await file.data.text();
          metrics = JSON.parse(text);
        } else if (typeof file.data === "string") {
          metrics = JSON.parse(file.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch metrics JSON for assessment", gardenAssessmentUID, error);
    }
  }

  const evidenceMedia = await Promise.all(
    evidenceMediaHashes.map(async (hash) => {
      try {
        const file = await getFileByHash(hash);
        if (file?.data instanceof Blob) {
          return URL.createObjectURL(file.data as Blob);
        }
        if (typeof file?.data === "string") {
          return file.data;
        }
        return toGatewayUrl(hash);
      } catch (error) {
        console.error("Failed to fetch evidence media", hash, error);
        return toGatewayUrl(hash);
      }
    })
  );

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
    metrics,
    evidenceMedia,
    reportDocuments: reportDocumentsRaw.map((doc) => toGatewayUrl(doc)),
    impactAttestations: impactAttestationsRaw,
    startDate,
    endDate,
    location,
    tags,
    createdAt: attestation.time,
  };
};

const parseDataToWork = async (
  workUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: any
): Promise<WorkCard> => {
  const data = JSON.parse(decodedDataJson);

  // Safely extract media with error handling
  const mediaData = data.find((d: any) => d.name === "media");
  const media: string[] = mediaData?.value?.value || [];

  const mediaUrls = await Promise.all(
    media.map(async (hash: string) => {
      try {
        const file = await getFileByHash(hash);
        return URL.createObjectURL(file.data as Blob);
      } catch (error) {
        console.error(`Failed to fetch media ${hash}:`, error);
        return "/images/no-image-placeholder.png";
      }
    })
  );

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
    media: mediaUrls.length > 0 ? mediaUrls : ["/images/no-image-placeholder.png"],
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
): WorkApproval => {
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

/** Fetches garden assessment attestations and resolves media references into view models. */
export const getGardenAssessments = async (
  gardenAddress?: string,
  chainId?: number | string
): Promise<GardenAssessment[]> => {
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

  return await Promise.all(
    data?.attestations.map(async ({ id, attester, recipient, timeCreated, decodedDataJson }) => {
      const timestamp = typeof timeCreated === "string" ? Number(timeCreated) : (timeCreated ?? 0);
      return await parseDataToGardenAssessment(
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

/** Queries work attestations for a garden and resolves associated media assets. */
export const getWorks = async (
  gardenAddress?: string,
  chainId?: number | string
): Promise<WorkCard[]> => {
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
  if (!data) console.error("No data found");

  const works = Promise.all(
    data?.attestations.map(
      async ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
        await parseDataToWork(id, { attester, recipient, time: timeCreated }, decodedDataJson)
    ) ?? []
  );

  return works;
};

/** Retrieves work attestations submitted by a specific gardener across gardens. */
export const getWorksByGardener = async (
  gardenerAddress?: string,
  chainId?: number | string
): Promise<WorkCard[]> => {
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
        await parseDataToWork(id, { attester, recipient, time: timeCreated }, decodedDataJson)
    )
  );
};

/** Loads work approval attestations, optionally filtered to a gardener recipient. */
export const getWorkApprovals = async (
  gardenerAddress?: string,
  chainId?: number | string
): Promise<WorkApproval[]> => {
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
