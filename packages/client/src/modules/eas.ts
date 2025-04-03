import { EAS } from "@/constants";

import { easGraphQL } from "./graphql";
import { getFileByHash } from "./pinata";
import { easArbitrumClient } from "./urql";

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
    soilMoisturePercentage: data.filter(
      (d: any) => d.name === "soilMoisturePercentage"
    )[0].value.value!,
    carbonTonStock: Number(
      data.filter((d: any) => d.name === "carbonTonStock")[0].value.value.hex!
    ),
    carbonTonPotential: Number(
      data.filter((d: any) => d.name === "carbonTonPotential")[0].value.value
        .hex!
    ),
    gardenSquareMeters: Number(
      data.filter((d: any) => d.name === "gardenSquareMeters")[0].value.value
        .hex!
    ),
    biome: data.filter((d: any) => d.name === "biome")[0].value.value!,
    remoteReport:
      typeof report.data === "string" ?
        report.data
      : URL.createObjectURL(report.data as Blob),
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
    polygonCoordinates: data.filter(
      (d: any) => d.name === "polygonCoordinates"
    )[0].value.value!,
    treeGenusesObserved: data.filter(
      (d: any) => d.name === "treeGenusesObserved"
    )[0].value.value!,
    weedGenusesObserved: data.filter(
      (d: any) => d.name === "weedGenusesObserved"
    )[0].value.value!,
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

  const media: string[] = data.filter((d: any) => d.name === "media")[0].value
    .value!;

  const mediaUrls = await Promise.all(
    media.map(async (hash: string) => {
      const file = await getFileByHash(hash);

      return URL.createObjectURL(file.data as Blob);
    })
  );

  return {
    id: workUID,
    gardenerAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    actionUID: Number(
      data.filter((d: any) => d.name === "actionUID")[0].value.value.hex!
    ),
    title: data.filter((d: any) => d.name === "title")[0].value.value!,
    feedback: data.filter((d: any) => d.name === "feedback")[0].value.value!,
    metadata: data.filter((d: any) => d.name === "metadata")[0].value.value!,
    media: mediaUrls,
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

  return {
    id: workApprovalUID,
    operatorAddress: attestation.attester,
    gardenerAddress: attestation.recipient,
    actionUID: data.filter((d: any) => d.name === "actionUID")[0].value.value!,
    workUID: data.filter((d: any) => d.name === "workUID")[0].value.value!,
    approved: data.filter((d: any) => d.name === "approved")[0].value.value!,
    feedback: data.filter((d: any) => d.name === "feedback")[0].value.value!,
    createdAt: attestation.time,
  };
};

export const getGardenAssessments = async (
  gardenAddress?: string
): Promise<GardenAssessment[]> => {
  // TODO add 'where: valid: true' filter
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

  const schemaId = { equals: EAS["42161"].GARDEN_ASSESSMENT.uid };

  const { data, error } = await easArbitrumClient
    .query(QUERY, {
      where:
        gardenAddress ?
          {
            schemaId,
            recipient: { equals: gardenAddress },
          }
        : {
            schemaId,
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

export const getWorks = async (gardenAddress?: string): Promise<WorkCard[]> => {
  // TODO add 'where: valid: true' filter
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

  const schemaId = { equals: EAS["42161"].WORK.uid };

  const { data, error } = await easArbitrumClient
    .query(QUERY, {
      where:
        gardenAddress ?
          { schemaId, recipient: { equals: gardenAddress } }
        : {
            schemaId,
          },
    })
    .toPromise();

  if (error) console.error(error);
  if (!data) console.error("No data found");

  const works = Promise.all(
    data?.attestations.map(
      async ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
        await parseDataToWork(
          id,
          { attester, recipient, time: timeCreated },
          decodedDataJson
        )
    ) ?? []
  );

  return works;
};

export const getWorkApprovals = async (
  gardenerAddress?: string
): Promise<WorkApproval[]> => {
  // TODO add 'where: valid: true' filter
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

  const schemaId = { equals: EAS["42161"].WORK_APPROVAL.uid };

  const { data, error } = await easArbitrumClient
    .query(QUERY, {
      where:
        gardenerAddress ?
          {
            schemaId,
            recipient: { equals: gardenerAddress },
          }
        : {
            schemaId,
          },
    })
    .toPromise();

  if (error) console.error(error);
  if (!data) console.error("No data found");

  return (
    data?.attestations.map(
      ({ id, attester, recipient, timeCreated, decodedDataJson }) =>
        parseDataToWorkApproval(
          id,
          { attester, recipient, time: timeCreated },
          decodedDataJson
        )
    ) ?? []
  );
};
