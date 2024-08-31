import { encodeFunctionData } from "viem";
import {
  SchemaEncoder,
  ZERO_BYTES32,
  NO_EXPIRATION,
} from "@ethereum-attestation-service/eas-sdk";

import { EAS } from "@/constants";
import { uploadFileToIPFS, uploadJSONToIPFS } from "@/modules/pinata";

const value = 0n;

export function encodeAttestCallData(
  schema: `0x${string}`,
  data: `0x${string}`,
  recipient: `0x${string}`
) {
  return encodeFunctionData({
    abi: [
      {
        inputs: [
          {
            components: [
              {
                internalType: "bytes32",
                name: "schema",
                type: "bytes32",
              },
              {
                components: [
                  {
                    internalType: "address",
                    name: "recipient",
                    type: "address",
                  },
                  {
                    internalType: "uint64",
                    name: "expirationTime",
                    type: "uint64",
                  },
                  {
                    internalType: "bool",
                    name: "revocable",
                    type: "bool",
                  },
                  {
                    internalType: "bytes32",
                    name: "refUID",
                    type: "bytes32",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                  {
                    internalType: "uint256",
                    name: "value",
                    type: "uint256",
                  },
                ],
                internalType: "struct AttestationRequestData",
                name: "data",
                type: "tuple",
              },
            ],
            internalType: "struct AttestationRequest",
            name: "request",
            type: "tuple",
          },
        ],
        name: "attest",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
    ],
    args: [
      {
        schema,
        data: {
          data,
          recipient,
          value,
          revocable: true,
          refUID: ZERO_BYTES32,
          expirationTime: NO_EXPIRATION,
        },
      },
    ],
  });
}

export async function encodeWorkData(
  data: WorkDraft,
  recipient: `0x${string}`
) {
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
    { name: "metadata", value: metadata, type: "string" },
    { name: "media", value: media, type: "string[]" },
  ]) as `0x${string}`;

  return encodeAttestCallData(schema, encodedData, recipient);
}

export function encodeWorkApprovalData(
  data: WorkApprovalDraft,
  recipient: `0x${string}`
) {
  const schema = EAS["42161"].WORK_APPROVAL.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "workUID", value: data.workUID, type: "bytes32" },
    { name: "approved", value: data.approved, type: "bool" },
    { name: "feedback", value: data.feedback, type: "string" },
  ]) as `0x${string}`;

  return encodeAttestCallData(schema, encodedData, recipient);
}
