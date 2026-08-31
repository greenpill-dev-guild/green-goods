/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { decodeAbiParameters } from "viem";
import sepoliaDeployment from "@green-goods/contracts/deployments/11155111-latest.json";

const WORK_APPROVAL_SCHEMA =
  "uint256 actionUID,bytes32 workUID,bool approved,string feedback,uint8 confidence,uint8 verificationMethod,string reviewNotesCID";

const mocks = vi.hoisted(() => ({
  getEASConfig: vi.fn(() => ({
    WORK: {
      schema: "uint256 actionUID,string title,string feedback,string metadata,string[] media",
    },
    WORK_APPROVAL: {
      schema:
        "uint256 actionUID,bytes32 workUID,bool approved,string feedback,uint8 confidence,uint8 verificationMethod,string reviewNotesCID",
    },
  })),
}));

// This conformance test intentionally replaces the suite-wide constant-output
// double with an independently encoded, strict schema double. Other shared tests
// retain the light mock, while this file fails on schema/name/type/order drift.
vi.mock("@ethereum-attestation-service/eas-sdk", async () => {
  const { encodeAbiParameters } = await vi.importActual<typeof import("viem")>("viem");
  const expectedSchema =
    "uint256 actionUID,bytes32 workUID,bool approved,string feedback,uint8 confidence,uint8 verificationMethod,string reviewNotesCID";
  const expectedFields = [
    { name: "actionUID", type: "uint256" },
    { name: "workUID", type: "bytes32" },
    { name: "approved", type: "bool" },
    { name: "feedback", type: "string" },
    { name: "confidence", type: "uint8" },
    { name: "verificationMethod", type: "uint8" },
    { name: "reviewNotesCID", type: "string" },
  ] as const;

  class ConformanceSchemaEncoder {
    constructor(schema: string) {
      if (schema !== expectedSchema) {
        throw new Error(`Unexpected WorkApproval schema: ${schema}`);
      }
    }

    encodeData(data: Array<{ name: string; value: unknown; type: string }>) {
      if (data.length !== expectedFields.length) {
        throw new Error(`Unexpected WorkApproval field count: ${data.length}`);
      }
      data.forEach((field, index) => {
        const expected = expectedFields[index];
        if (field.name !== expected.name || field.type !== expected.type) {
          throw new Error(`Unexpected WorkApproval field ${index}: ${field.type} ${field.name}`);
        }
      });
      return encodeAbiParameters(
        expectedFields,
        data.map(({ value }) => value) as [
          bigint,
          `0x${string}`,
          boolean,
          string,
          number,
          number,
          string,
        ]
      );
    }
  }

  return { SchemaEncoder: ConformanceSchemaEncoder };
});

vi.mock("../../config/blockchain", () => ({
  getEASConfig: mocks.getEASConfig,
}));

vi.mock("../../modules/data/ipfs", () => ({
  uploadFileToIPFS: vi.fn(),
  uploadJSONToIPFS: vi.fn(),
}));

vi.mock("../../modules/app/error-tracking", () => ({
  trackUploadBatchProgress: vi.fn(),
  trackUploadError: vi.fn(),
}));

import type { WorkApprovalDraft } from "../../types/domain";
import { Confidence, VerificationMethod } from "../../types/domain";
import { encodeWorkApprovalData } from "../../utils/eas/encoders";

const ABI_PARAMETERS = [
  { name: "actionUID", type: "uint256" },
  { name: "workUID", type: "bytes32" },
  { name: "approved", type: "bool" },
  { name: "feedback", type: "string" },
  { name: "confidence", type: "uint8" },
  { name: "verificationMethod", type: "uint8" },
  { name: "reviewNotesCID", type: "string" },
] as const;

const RICH_ENCODING = [
  "0x000000000000000000000000000000000000000000000000000000000000002a",
  "abababababababababababababababababababababababababababababababab",
  "0000000000000000000000000000000000000000000000000000000000000001",
  "00000000000000000000000000000000000000000000000000000000000000e0",
  "0000000000000000000000000000000000000000000000000000000000000003",
  "0000000000000000000000000000000000000000000000000000000000000003",
  "0000000000000000000000000000000000000000000000000000000000000140",
  "0000000000000000000000000000000000000000000000000000000000000022",
  "476f6f642065766964656e636520e28094207665726966696564206f6e207369",
  "7465000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000023",
  "62616679626569676479727a74357366703775646d3768753736756837793236",
  "6e66330000000000000000000000000000000000000000000000000000000000",
].join("") as `0x${string}`;

const REJECTION_ENCODING = [
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "00000000000000000000000000000000000000000000000000000000000000e0",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000001",
  "0000000000000000000000000000000000000000000000000000000000000100",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
].join("") as `0x${string}`;

describe("encodeWorkApprovalData", () => {
  it("matches independent ABI encoding for the exact schema, order, types, and values", () => {
    const draft: WorkApprovalDraft = {
      actionUID: 42,
      workUID: `0x${"ab".repeat(32)}`,
      approved: true,
      feedback: "Good evidence — verified on site",
      confidence: Confidence.HIGH,
      verificationMethod: VerificationMethod.HUMAN | VerificationMethod.IOT,
      reviewNotesCID: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3",
    };

    const encoded = encodeWorkApprovalData(draft, 11155111);
    expect(sepoliaDeployment.schemas.workApprovalSchema).toBe(WORK_APPROVAL_SCHEMA);
    expect(mocks.getEASConfig).toHaveBeenCalledWith(11155111);
    expect(encoded).toBe(RICH_ENCODING);
    expect(encoded).not.toBe("0x");
    expect(encoded.length).toBeGreaterThan(2 + 64 * ABI_PARAMETERS.length);
    expect(decodeAbiParameters(ABI_PARAMETERS, encoded)).toEqual([
      42n,
      draft.workUID,
      true,
      draft.feedback,
      Confidence.HIGH,
      VerificationMethod.HUMAN | VerificationMethod.IOT,
      draft.reviewNotesCID,
    ]);
  });

  it("encodes rejection boundaries and optional strings as empty values", () => {
    const draft: WorkApprovalDraft = {
      actionUID: 0,
      workUID: `0x${"00".repeat(32)}`,
      approved: false,
      confidence: Confidence.NONE,
      verificationMethod: VerificationMethod.HUMAN,
    };

    const encoded = encodeWorkApprovalData(draft, "42161");

    expect(encoded).toBe(REJECTION_ENCODING);
    expect(decodeAbiParameters(ABI_PARAMETERS, encoded)).toEqual([
      0n,
      draft.workUID,
      false,
      "",
      Confidence.NONE,
      VerificationMethod.HUMAN,
      "",
    ]);
  });

  it("rejects an invalid bytes32 value instead of returning plausible-looking output", () => {
    expect(() =>
      encodeWorkApprovalData(
        {
          actionUID: 1,
          workUID: "0x1234",
          approved: true,
          confidence: Confidence.MEDIUM,
          verificationMethod: VerificationMethod.HUMAN,
        },
        11155111
      )
    ).toThrow();
  });
});
