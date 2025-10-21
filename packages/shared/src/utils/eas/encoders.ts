import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { getEASConfig } from "../../config/blockchain";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../../modules/data/pinata";

/** Uploads supporting files and encodes a work attestation payload for EAS. */
export async function encodeWorkData(data: WorkDraft, chainId: number | string) {
  const easConfig = getEASConfig(chainId);
  const schema = easConfig.WORK.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const media = await Promise.all(
    data.media.map(async (file: File) => {
      return (await uploadFileToIPFS(file)).cid;
    })
  );

  const metadata = await uploadJSONToIPFS({
    plantSelection: data.plantSelection,
    plantCount: data.plantCount,
  });

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "title", value: data.title, type: "string" },
    { name: "feedback", value: data.feedback, type: "string" },
    { name: "metadata", value: metadata.cid, type: "string" },
    { name: "media", value: media, type: "string[]" },
  ]) as `0x${string}`;

  return encodedData;
}

/** Produces an EAS payload for work approval attestations without side effects. */
export function encodeWorkApprovalData(data: WorkApprovalDraft, chainId: number | string) {
  const easConfig = getEASConfig(chainId);
  const schema = easConfig.WORK_APPROVAL.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "workUID", value: data.workUID, type: "bytes32" },
    { name: "approved", value: data.approved, type: "bool" },
    { name: "feedback", value: data.feedback ?? "", type: "string" },
  ]) as `0x${string}`;

  return encodedData;
}

/** Prepares assessment attestation data, including IPFS uploads for metrics and media. */
export async function encodeAssessmentData(data: AssessmentDraft, chainId: number | string) {
  const easConfig = getEASConfig(chainId);
  if (!easConfig.ASSESSMENT || !easConfig.ASSESSMENT.schema) {
    throw new Error(`Assessment EAS config not found for chain ${chainId}`);
  }
  const schema = easConfig.ASSESSMENT.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  // Upload metrics to IPFS
  const metricsJSON = await uploadJSONToIPFS(data.metrics);

  // Upload evidence media
  const evidenceMedia = await Promise.all(
    data.evidenceMedia.map(async (file: File) => {
      return (await uploadFileToIPFS(file)).cid;
    })
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "title", value: data.title, type: "string" },
    { name: "description", value: data.description, type: "string" },
    { name: "assessmentType", value: data.assessmentType, type: "string" },
    { name: "capitals", value: data.capitals, type: "string[]" },
    { name: "metricsJSON", value: metricsJSON.cid, type: "string" },
    { name: "evidenceMedia", value: evidenceMedia, type: "string[]" },
    { name: "reportDocuments", value: data.reportDocuments || [], type: "string[]" },
    { name: "impactAttestations", value: data.impactAttestations || [], type: "bytes32[]" },
    { name: "startDate", value: data.startDate, type: "uint256" },
    { name: "endDate", value: data.endDate, type: "uint256" },
    { name: "location", value: data.location, type: "string" },
    { name: "tags", value: data.tags, type: "string[]" },
  ]) as `0x${string}`;

  return encodedData;
}
