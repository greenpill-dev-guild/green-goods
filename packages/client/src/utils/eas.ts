import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { getEASConfig } from "@/config";
import { uploadFileToIPFS, uploadJSONToIPFS } from "@/modules/pinata";

export async function encodeWorkData(data: WorkDraft, chainId: number | string) {
  const easConfig = getEASConfig(chainId);
  const schema = easConfig.WORK.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const media = await Promise.all(
    (data.media || []).map(async (fileOrCid: any) => {
      if (typeof fileOrCid === "string") return fileOrCid;
      return (await uploadFileToIPFS(fileOrCid)).cid;
    })
  );

  const metadataCID =
    typeof (data as any).metadata === "string" && (data as any).metadata.length > 10
      ? (data as any).metadata
      : (
          await uploadJSONToIPFS({
            plantSelection: data.plantSelection,
            plantCount: data.plantCount,
          })
        ).cid;

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "title", value: data.title, type: "string" },
    { name: "feedback", value: data.feedback, type: "string" },
    { name: "metadata", value: metadataCID, type: "string" },
    { name: "media", value: media, type: "string[]" },
  ]) as `0x${string}`;

  return encodedData;
}

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
