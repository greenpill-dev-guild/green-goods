import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { getEASConfig } from "@/constants";
import { uploadFileToIPFS, uploadJSONToIPFS } from "@/modules/pinata";

export async function encodeWorkData(data: WorkDraft, chainId: number | string = 42161) {
  const easConfig = getEASConfig(chainId);
  const schema = easConfig.WORK.schema as `0x${string}`;
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

export function encodeWorkApprovalData(data: WorkApprovalDraft, chainId: number | string = 42161) {
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
