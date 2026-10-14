import { encodeFunctionData, getAddress, zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import {
  buildEnvelope,
  decodeAttestCall,
  EAS_ATTEST_ABI,
  encodeSchemaData,
  envelopeIssues,
  envelopePayloadDigest,
  type PublicationEnvelope,
  ReportingDeploymentError,
  resolveReportingDeployment,
} from "../../../modules/agent-reporting/envelope";

// Produced once by the real EAS SDK SchemaEncoder (this suite aliases the SDK to a mock), so the
// schema encoding is proven byte-identical to what the app's own publication path writes.
const WORK_VECTOR =
  "0x000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000011506c616e74656420736565646c696e67730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022506c616e74656420313220736565646c696e6773206279207468652066656e63652e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f6261666b7265696d657461646174610000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000d6261666b72656970686f746f3100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d6261666b72656970686f746f3200000000000000000000000000000000000000";
const APPROVAL_VECTOR =
  "0x0000000000000000000000000000000000000000000000000000000000000007abababababababababababababababababababababababababababababababab000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000a4c6f6f6b7320676f6f64000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

const deployment = resolveReportingDeployment(42161);
const ACCOUNT = "0x00000000000000000000000000000000000000A1";
const GARDEN = "0x00000000000000000000000000000000000000C2";
const WORK_UID = `0x${"ab".repeat(32)}` as const;

function workEnvelope(): PublicationEnvelope {
  return buildEnvelope(deployment, {
    kind: "work",
    operationId: "op-1",
    revision: 3,
    chainId: 42161,
    accountAddress: ACCOUNT,
    gardenAddress: GARDEN,
    clientWorkId: "cw-1",
    actionDefinitionDigest: `0x${"12".repeat(32)}`,
    fields: {
      actionUID: "7",
      title: "Planted seedlings",
      feedback: "Planted 12 seedlings by the fence.",
      metadata: "bafkreimetadata",
      media: ["bafkreiphoto1", "bafkreiphoto2"],
    },
    media: [],
    metadataDigest: `0x${"34".repeat(32)}`,
  });
}

describe("reporting deployment", () => {
  it("refuses chains outside the reporting deployment instead of falling back to Arbitrum", () => {
    expect(() => resolveReportingDeployment(42220)).toThrow(ReportingDeploymentError);
    expect(deployment.work.schemaUID).toMatch(/^0x43ebd37d/);
  });
});

describe("publication envelopes", () => {
  it("encodes work and review data exactly as the EAS SDK does", () => {
    expect(workEnvelope().encodedData).toBe(WORK_VECTOR);
    expect(
      encodeSchemaData(deployment.review.schema, [7n, WORK_UID, true, "Looks good", 2, 1, ""])
    ).toBe(APPROVAL_VECTOR);
  });

  it("freezes one zero-value attest to the garden with Green Goods request defaults", () => {
    const envelope = workEnvelope();
    expect(decodeAttestCall(envelope.call.data)).toEqual({
      schema: deployment.work.schemaUID,
      recipient: getAddress(GARDEN),
      expirationTime: 0n,
      revocable: false,
      refUID: zeroHash,
      data: WORK_VECTOR,
      value: 0n,
    });
    expect(envelope.call.value).toBe("0");
    expect(envelopeIssues(envelope, { deployment, account: ACCOUNT })).toEqual([]);
  });

  const withCall = (envelope: PublicationEnvelope, request: Record<string, unknown>) => {
    const decoded = decodeAttestCall(envelope.call.data);
    const data = encodeFunctionData({
      abi: EAS_ATTEST_ABI,
      functionName: "attest",
      args: [{ schema: decoded.schema, data: { ...decoded, ...request } as never }],
    });
    const next = { ...envelope, call: { ...envelope.call, data } };
    return { ...next, payloadDigest: envelopePayloadDigest(next) };
  };

  it.each([
    ["digest_mismatch", (e: PublicationEnvelope) => ({ ...e, revision: 4 })],
    [
      "wrong_target",
      (e: PublicationEnvelope) => {
        const next = {
          ...e,
          call: { ...e.call, to: "0x00000000000000000000000000000000000000EE" as const },
        };
        return { ...next, payloadDigest: envelopePayloadDigest(next) };
      },
    ],
    ["wrong_recipient", (e: PublicationEnvelope) => withCall(e, { recipient: ACCOUNT })],
    ["request_defaults", (e: PublicationEnvelope) => withCall(e, { revocable: true })],
    ["nonzero_value", (e: PublicationEnvelope) => withCall(e, { value: 1n })],
    ["payload_mismatch", (e: PublicationEnvelope) => withCall(e, { data: APPROVAL_VECTOR })],
  ])("rejects a tampered envelope as %s", (issue, tamper) => {
    expect(envelopeIssues(tamper(workEnvelope()), { deployment, account: ACCOUNT })).toContain(
      issue
    );
  });

  it("rejects an envelope for a different account", () => {
    expect(
      envelopeIssues(workEnvelope(), {
        deployment,
        account: "0x00000000000000000000000000000000000000A9",
      })
    ).toEqual(["wrong_account"]);
  });
});
