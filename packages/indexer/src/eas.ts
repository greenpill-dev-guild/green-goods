import { EAS } from "@ethereum-attestation-service/eas-sdk";

import { GardenAssessment, Work, WorkApproval } from "generated";

const eas = new EAS("0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458");

const getWorkAttestation = async (workUID: string): Promise<Work> => {
  const attestation = await eas.getAttestation(workUID);
  const data = JSON.parse(attestation.data);

  return {
    id: workUID,
    ownerAddress: attestation.attester,
    garden_id: attestation.recipient,
    action_id: data.filter((d: any) => d.name === "actionUID")[0].value.value!,
    title: data.filter((d: any) => d.name === "title")[0].value.value!,
    feedback: data.filter((d: any) => d.name === "feedback")[0].value.value!,
    metadata: data.filter((d: any) => d.name === "metadata")[0].value.value!,
    media: data.filter((d: any) => d.name === "media")[0].value.value!,
    createdAt: attestation.time,
  };
};

const getWorkApprovalAttestation = async (
  workApprovalUID: string
): Promise<WorkApproval> => {
  const attestation = await eas.getAttestation(workApprovalUID);
  const data = JSON.parse(attestation.data);

  return {
    id: workApprovalUID,
    approverAddress: attestation.attester,
    action_id: data.filter((d: any) => d.name === "actionUID")[0].value.value!,
    work_id: data.filter((d: any) => d.name === "workUID")[0].value.value!,
    approved: data.filter((d: any) => d.name === "approved")[0].value.value!,
    feedback: data.filter((d: any) => d.name === "feedback")[0].value.value!,
    createdAt: attestation.time,
  };
};

const getGardenAssessmentAttestation = async (
  gardenAssessmentUID: string
): Promise<GardenAssessment> => {
  const attestation = await eas.getAttestation(gardenAssessmentUID);
  const data = JSON.parse(attestation.data);

  return {
    id: gardenAssessmentUID,
    authorAddress: attestation.attester,
    garden_id: attestation.recipient,
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

export {
  getWorkAttestation,
  getWorkApprovalAttestation,
  getGardenAssessmentAttestation,
};
