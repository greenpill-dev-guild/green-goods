import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { EAS } from "@/constants";
import { uploadFileToIPFS, uploadJSONToIPFS } from "@/modules/pinata";

export async function encodeWorkData(data: WorkDraft) {
  const schema = EAS["42161"].WORK.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const media = await Promise.all(
    data.media.map(async (file) => {
      return (await uploadFileToIPFS(file)).IpfsHash;
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
    { name: "metadata", value: metadata.IpfsHash, type: "string" },
    { name: "media", value: media, type: "string[]" },
  ]) as `0x${string}`;

  return encodedData;
}

export function encodeWorkApprovalData(data: WorkApprovalDraft) {
  const schema = EAS["42161"].WORK_APPROVAL.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "workUID", value: data.workUID, type: "bytes32" },
    { name: "approved", value: data.approved, type: "bool" },
    { name: "feedback", value: data.feedback ?? "", type: "string" },
  ]) as `0x${string}`;

  return encodedData;
}
