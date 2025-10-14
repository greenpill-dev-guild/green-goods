import { getEASConfig } from "@/config/blockchain";

import { easGraphQL } from "./graphql";
import { getFileByHash } from "./pinata";
import { createEasClient } from "./urql";

const parseDataToGardenAssessment = async (
  gardenAssessmentUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: any
): Promise<GardenAssessment> => {
  const data = JSON.parse(decodedDataJson);

  const report = await getFileByHash(
    data.filter((d: any) => d.name === "remoteReportPDF")[0].value.value!
  );
  const species = await getFileByHash(
    data.filter((d: any) => d.name === "speciesRegistryJSON")[0].value.value!
  );

  const speciesRegistry: SpeciesRegistry = species.data as any;

  const issues = data
    .filter((d: any) => d.name === "issues")[0]
    .value.value.map((issue: string) => issue.replace("_", " "));
  const tags = data
    .filter((d: any) => d.name === "tags")[0]
    .value.value.map((tag: string) => tag.replace("_", " "));

  return {
    id: gardenAssessmentUID,
    authorAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    soilMoisturePercentage: data.filter((d: any) => d.name === "soilMoisturePercentage")[0].value
      .value!,
    carbonTonStock: Number(
      data.filter((d: any) => d.name === "carbonTonStock")[0].value.value.hex!
    ),
    carbonTonPotential: Number(
      data.filter((d: any) => d.name === "carbonTonPotential")[0].value.value.hex!
    ),
    gardenSquareMeters: Number(
      data.filter((d: any) => d.name === "gardenSquareMeters")[0].value.value.hex!
    ),
    biome: data.filter((d: any) => d.name === "biome")[0].value.value!,
    remoteReport:
      typeof report.data === "string" ? report.data : URL.createObjectURL(report.data as Blob),
    speciesRegistry: {
      trees: await Promise.all(
        speciesRegistry.trees.map(async (tree: any) => ({
          genus: tree.genus,
          height: tree.height_in_meters,
          latitude: tree.coordinates.latitude,
          longitude: tree.coordinates.longitude,
          image: await getFileByHash(tree.image_cid).then((file) =>
            URL.createObjectURL(file.data as Blob)
          ),
        }))
      ),
      weeds: await Promise.all(
        speciesRegistry.weeds.map(async (weed: any) => ({
          genus: weed.genus,
          height: weed.height_in_meters,
          latitude: weed.coordinates.latitude,
          longitude: weed.coordinates.longitude,
          image: await getFileByHash(weed.image_cid).then((file) =>
            URL.createObjectURL(file.data as Blob)
          ),
        }))
      ),
    },
    polygonCoordinates: data.filter((d: any) => d.name === "polygonCoordinates")[0].value.value!,
    treeGenusesObserved: data.filter((d: any) => d.name === "treeGenusesObserved")[0].value.value!,
    weedGenusesObserved: data.filter((d: any) => d.name === "weedGenusesObserved")[0].value.value!,
    issues,
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
    data?.attestations.map(
      async ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
        await parseDataToGardenAssessment(
          id,
          {
            attester,
            recipient,
            time: timeCreated,
          },
          decodedDataJson
        )
    ) ?? []
  );
};

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

// Fetch works by gardener (attester) across all gardens
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
