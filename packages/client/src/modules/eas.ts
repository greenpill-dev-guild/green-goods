import { graphql } from "gql.tada";

import { EAS } from "@/constants";

import { easArbitrumClient } from "./urql";

const parseDataToWork = (
  workUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: any
): Work => {
  const data = JSON.parse(decodedDataJson);

  return {
    id: workUID,
    gardenerAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    actionUID: data.filter((d: any) => d.name === "actionUID")[0].value.value!,
    title: data.filter((d: any) => d.name === "title")[0].value.value!,
    feedback: data.filter((d: any) => d.name === "feedback")[0].value.value!,
    metadata: data.filter((d: any) => d.name === "metadata")[0].value.value!,
    media: data.filter((d: any) => d.name === "media")[0].value.value!,
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
    approverAddress: attestation.attester,
    recipientAddress: attestation.recipient,
    actionUID: data.filter((d: any) => d.name === "actionUID")[0].value.value!,
    workUID: data.filter((d: any) => d.name === "workUID")[0].value.value!,
    approved: data.filter((d: any) => d.name === "approved")[0].value.value!,
    feedback: data.filter((d: any) => d.name === "feedback")[0].value.value!,
    createdAt: attestation.time,
  };
};

const parseDataToGardenAssessment = (
  gardenAssessmentUID: string,
  attestation: {
    attester: string;
    recipient: string;
    time: number;
  },
  decodedDataJson: any
): GardenAssessment => {
  const data = JSON.parse(decodedDataJson);

  return {
    id: gardenAssessmentUID,
    authorAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    soilMoisturePercentage: data.filter(
      (d: any) => d.name === "soilMoisturePercentage"
    )[0].value.value!,
    carbonTonStock: data.filter((d: any) => d.name === "carbonTonStock")[0]
      .value.value!,
    carbonTonPotential: data.filter(
      (d: any) => d.name === "carbonTonPotential"
    )[0].value.value!,
    gardenSquareMeters: data.filter(
      (d: any) => d.name === "gardenSquareMeters"
    )[0].value.value!,
    biome: data.filter((d: any) => d.name === "biome")[0].value.value!,
    remoteReportCID: data.filter((d: any) => d.name === "remoteReportPDF")[0]
      .value.value!,
    speciesRegistryCID: data.filter(
      (d: any) => d.name === "speciesRegistryJSON"
    )[0].value.value!,
    polygonCoordinates: data.filter(
      (d: any) => d.name === "polygonCoordinates"
    )[0].value.value!,
    treeGenusesObserved: data.filter(
      (d: any) => d.name === "treeGenusesObserved"
    )[0].value.value!,
    weedGenusesObserved: data.filter(
      (d: any) => d.name === "weedGenusesObserved"
    )[0].value.value!,
    issues: data.filter((d: any) => d.name === "issues")[0].value.value!,
    tags: data.filter((d: any) => d.name === "tags")[0].value.value!,
    createdAt: attestation.time,
  };
};

export const getWorks = async (): Promise<WorkCard[]> => {
  // TODO add 'where: valid: true' filter
  const QUERY = graphql(/* GraphQL */ `
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

  const { data, error } = await easArbitrumClient
    .query(QUERY, {
      where: {
        schemaId: { equals: EAS["42161"].WORK.uid },
      },
    })
    .toPromise();

  if (error) console.error(error);
  if (!data) console.error("No data found");

  return (
    data?.attestations.map(({ id, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWork(
        id,
        { attester: recipient, recipient, time: timeCreated },
        decodedDataJson
      )
    ) ?? []
  );
};

export const getWorkApprovals = async (): Promise<WorkApprovalCard[]> => {
  // TODO add 'where: valid: true' filter
  const QUERY = graphql(/* GraphQL */ `
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

  const { data, error } = await easArbitrumClient
    .query(QUERY, {
      where: {
        schemaId: { equals: EAS["42161"].WORK_APPROVAL.uid },
      },
    })
    .toPromise();

  if (error) console.error(error);
  if (!data) console.error("No data found");

  return (
    data?.attestations.map(({ id, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWorkApproval(
        id,
        { attester: recipient, recipient, time: timeCreated },
        decodedDataJson
      )
    ) ?? []
  );
};

export const getGardenAssessments = async (): Promise<GardenAssessment[]> => {
  // TODO add 'where: valid: true' filter
  const QUERY = graphql(/* GraphQL */ `
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

  const { data, error } = await easArbitrumClient
    .query(QUERY, {
      where: {
        schemaId: { equals: EAS["42161"].GARDEN_ASSESSMENT.uid },
      },
    })
    .toPromise();

  if (error) console.error(error);
  if (!data) console.error("No data found");

  return (
    data?.attestations.map(({ id, recipient, timeCreated, decodedDataJson }) =>
      parseDataToGardenAssessment(
        id,
        {
          attester: recipient,
          recipient,
          time: timeCreated,
        },
        decodedDataJson
      )
    ) ?? []
  );
};
