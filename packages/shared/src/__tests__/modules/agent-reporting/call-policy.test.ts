import { decodeFunctionData, encodeFunctionData, type Hex, pad, zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import {
  ATTEST_SELECTOR,
  attestCallFailures,
  type AttestScope,
} from "../../../modules/agent-reporting/call-policy";
import {
  buildEnvelope,
  EAS_ATTEST_ABI,
  resolveReportingDeployment,
} from "../../../modules/agent-reporting/envelope";

/**
 * Offline proof of the delegated call rules against real calldata. The on-chain call policy must
 * still be shown to apply the same offsets on the pinned Kernel module before delegation is on.
 */
const deployment = resolveReportingDeployment(42161);
const GARDEN = "0x00000000000000000000000000000000000000c2";
const OTHER_GARDEN = "0x00000000000000000000000000000000000000d3";

const reporting: AttestScope = {
  purpose: "reporting",
  easAddress: deployment.easAddress,
  schemaUID: deployment.work.schemaUID,
  gardenAddress: GARDEN,
};

function workCall(garden: `0x${string}` = GARDEN) {
  const envelope = buildEnvelope(deployment, {
    kind: "work",
    operationId: "op-1",
    revision: 1,
    chainId: 42161,
    accountAddress: "0x00000000000000000000000000000000000000a1",
    gardenAddress: garden,
    clientWorkId: "cw-1",
    actionDefinitionDigest: `0x${"12".repeat(32)}`,
    fields: { actionUID: "7", title: "Planting", feedback: "", metadata: "bafy", media: [] },
    media: [],
    metadataDigest: `0x${"34".repeat(32)}`,
  });
  return { to: envelope.call.to, value: 0n, data: envelope.call.data };
}

function attestCall(
  overrides: Partial<{
    recipient: Hex;
    revocable: boolean;
    refUID: Hex;
    value: bigint;
    expirationTime: bigint;
    schema: Hex;
  }>
) {
  return {
    to: deployment.easAddress,
    value: 0n,
    data: encodeFunctionData({
      abi: EAS_ATTEST_ABI,
      functionName: "attest",
      args: [
        {
          schema: overrides.schema ?? deployment.work.schemaUID,
          data: {
            recipient: overrides.recipient ?? GARDEN,
            expirationTime: overrides.expirationTime ?? 0n,
            revocable: overrides.revocable ?? false,
            refUID: overrides.refUID ?? zeroHash,
            data: "0x1234",
            value: overrides.value ?? 0n,
          },
        },
      ],
    }),
  };
}

describe("delegated attest call rules", () => {
  it("accept exactly the canonical work attestation for the granted garden", () => {
    expect(attestCallFailures(reporting, workCall())).toEqual([]);
    expect(workCall().data.slice(0, 10)).toBe(ATTEST_SELECTOR);
  });

  it("reject another garden, schema, target, value or request default", () => {
    expect(attestCallFailures(reporting, workCall(OTHER_GARDEN))).toEqual(["recipient"]);
    expect(
      attestCallFailures(reporting, attestCall({ schema: deployment.review.schemaUID }))
    ).toEqual(["schema"]);
    expect(attestCallFailures(reporting, attestCall({ revocable: true }))).toEqual(["revocable"]);
    expect(attestCallFailures(reporting, attestCall({ refUID: `0x${"01".repeat(32)}` }))).toEqual([
      "ref_uid",
    ]);
    expect(attestCallFailures(reporting, attestCall({ expirationTime: 1n }))).toEqual([
      "expiration_time",
    ]);
    expect(attestCallFailures(reporting, attestCall({ value: 1n }))).toEqual(["value"]);
    expect(attestCallFailures(reporting, { ...workCall(), value: 1n })).toEqual(["nonzero_value"]);
    expect(
      attestCallFailures(reporting, {
        ...workCall(),
        to: "0x0000000000000000000000000000000000000bad",
      })
    ).toEqual(["wrong_target"]);
  });

  it("never lets a reporting permission carry a review decision", () => {
    const review = {
      ...reporting,
      purpose: "review" as const,
      schemaUID: deployment.review.schemaUID,
    };
    expect(attestCallFailures(review, workCall())).toEqual(["schema"]);
    expect(
      attestCallFailures(reporting, attestCall({ schema: deployment.review.schemaUID }))
    ).toContain("schema");
  });

  it("catch a non-canonical encoding that keeps the allowed words but decodes elsewhere", () => {
    // Point the request data at a second struct placed after the original one. Every original word
    // still reads as the allowed garden, but an ABI decoder follows the pointer to OTHER_GARDEN.
    const canonical = workCall().data;
    const body = canonical.slice(10);
    const words = body.match(/.{64}/g) ?? [];
    const relocated = words.length * 32 - 0x20; // bytes from the request start to the appended copy
    const copy = words
      .slice(3)
      .map((wordHex, index) => (index === 0 ? pad(OTHER_GARDEN).slice(2) : wordHex));
    const hostileWords = [...words];
    hostileWords[2] = pad(`0x${relocated.toString(16)}`).slice(2);
    const hostile = `${ATTEST_SELECTOR}${[...hostileWords, ...copy].join("")}` as Hex;

    const decoded = decodeFunctionData({ abi: EAS_ATTEST_ABI, data: hostile });
    expect(decoded.args[0].data.recipient.toLowerCase()).toBe(OTHER_GARDEN);
    expect(
      attestCallFailures(reporting, { to: deployment.easAddress, value: 0n, data: hostile })
    ).toEqual(["data_pointer"]);
  });

  it("reject calldata too short to satisfy every rule", () => {
    expect(
      attestCallFailures(reporting, { to: deployment.easAddress, value: 0n, data: ATTEST_SELECTOR })
    ).toContain("truncated");
  });
});
