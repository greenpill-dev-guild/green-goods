import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import type { EASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import { APPROVAL_GAS_HEADROOM_PERCENT } from "../../utils/eas/constants";
import {
  buildApprovalAttestContractCall,
  buildQueuedAttestationsCall,
} from "../../utils/eas/transaction-builder";

const mockEasConfig: EASConfig = {
  ASSESSMENT: { uid: "0x" + "1".repeat(64), schema: "" },
  ASSESSMENT_V3: { uid: "0x" + "4".repeat(64), schema: "" },
  WORK: { uid: "0x" + "2".repeat(64), schema: "" },
  WORK_APPROVAL: { uid: "0x" + "3".repeat(64), schema: "" },
  EAS: { address: "0x0000000000000000000000000000000000001234" },
  SCHEMA_REGISTRY: { address: "0x0000000000000000000000000000000000005678" },
};

describe("utils/eas/transaction-builder", () => {
  describe("buildQueuedAttestationsCall", () => {
    const GARDEN_A = "0x00000000000000000000000000000000000000aa" as const;
    const GARDEN_B = "0x00000000000000000000000000000000000000bb" as const;
    const data = (byte: string) => `0x${byte.repeat(32)}` as `0x${string}`;
    const request = (recipient: `0x${string}`, attestationData: `0x${string}`) => ({
      recipient,
      expirationTime: 0n,
      revocable: false,
      refUID: `0x${"00".repeat(32)}`,
      data: attestationData,
      value: 0n,
    });
    const encode = (call: ReturnType<typeof buildQueuedAttestationsCall>) =>
      encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args });
    const EAS = mockEasConfig.EAS.address as `0x${string}`;
    const WORK = mockEasConfig.WORK.uid as `0x${string}`;
    const DECISION = mockEasConfig.WORK_APPROVAL.uid as `0x${string}`;
    const work = (gardenAddress: `0x${string}`, attestationData: `0x${string}`) => ({
      schema: WORK,
      gardenAddress,
      attestationData,
    });
    const decision = (gardenAddress: `0x${string}`, attestationData: `0x${string}`) => ({
      schema: DECISION,
      gardenAddress,
      attestationData,
    });

    it("sends a single queued item as a plain attest", () => {
      const call = buildQueuedAttestationsCall(EAS, [work(GARDEN_A, data("ab"))]);

      expect(call.address).toBe(mockEasConfig.EAS.address);
      expect(encode(call)).toBe(
        encodeFunctionData({
          abi: EASABI,
          functionName: "attest",
          args: [{ schema: mockEasConfig.WORK.uid, data: request(GARDEN_A, data("ab")) }],
        })
      );
    });

    it("sends many works as one multiAttest request group", () => {
      const call = buildQueuedAttestationsCall(EAS, [
        work(GARDEN_A, data("ab")),
        work(GARDEN_B, data("cd")),
      ]);

      expect(encode(call)).toBe(
        encodeFunctionData({
          abi: EASABI,
          functionName: "multiAttest",
          args: [
            [
              {
                schema: mockEasConfig.WORK.uid,
                data: [request(GARDEN_A, data("ab")), request(GARDEN_B, data("cd"))],
              },
            ],
          ],
        })
      );
    });

    it("sends work and decisions together, work first, one group per schema", () => {
      const call = buildQueuedAttestationsCall(EAS, [
        work(GARDEN_A, data("ab")),
        decision(GARDEN_B, data("ef")),
      ]);

      expect(encode(call)).toBe(
        encodeFunctionData({
          abi: EASABI,
          functionName: "multiAttest",
          args: [
            [
              { schema: mockEasConfig.WORK.uid, data: [request(GARDEN_A, data("ab"))] },
              { schema: mockEasConfig.WORK_APPROVAL.uid, data: [request(GARDEN_B, data("ef"))] },
            ],
          ],
        })
      );
    });

    it("keeps one group per schema however the items arrive, in the order each schema first appears", () => {
      // Any kind that becomes an attestation rides along by naming its schema.
      const OTHER = `0x${"9".repeat(64)}` as `0x${string}`;
      const call = buildQueuedAttestationsCall(EAS, [
        work(GARDEN_A, data("ab")),
        { schema: OTHER, gardenAddress: GARDEN_A, attestationData: data("01") },
        work(GARDEN_B, data("cd")),
      ]);

      expect(encode(call)).toBe(
        encodeFunctionData({
          abi: EASABI,
          functionName: "multiAttest",
          args: [
            [
              {
                schema: WORK,
                data: [request(GARDEN_A, data("ab")), request(GARDEN_B, data("cd"))],
              },
              { schema: OTHER, data: [request(GARDEN_A, data("01"))] },
            ],
          ],
        })
      );
    });

    it("refuses an empty send", () => {
      expect(() => buildQueuedAttestationsCall(EAS, [])).toThrow("Nothing is queued to send");
    });

    // A decision's resolver runs the Karma update inside try/catch; a send at the bare estimate
    // would land without it, so the call carries the most headroom any of its items asks for.
    it.each([
      { name: "work alone", items: [work(GARDEN_A, data("ab"))], headroom: undefined },
      {
        name: "a decision alone",
        items: [{ ...decision(GARDEN_A, data("ef")), gasHeadroomPercent: 50 }],
        headroom: 50,
      },
      {
        name: "work and a decision",
        items: [
          work(GARDEN_A, data("ab")),
          { ...decision(GARDEN_B, data("ef")), gasHeadroomPercent: 50 },
        ],
        headroom: 50,
      },
    ])("asks for the most gas headroom of its items: $name", ({ items, headroom }) => {
      expect(buildQueuedAttestationsCall(EAS, items).gasHeadroomPercent).toBe(headroom);
    });
  });

  describe("buildApprovalAttestContractCall", () => {
    it("sends one decision attestation with the approval gas headroom", () => {
      const attestationData = `0x${"ef".repeat(32)}` as `0x${string}`;
      const garden = "0x00000000000000000000000000000000000000aa" as const;
      const call = buildApprovalAttestContractCall(mockEasConfig, garden, attestationData);

      expect(call.gasHeadroomPercent).toBe(APPROVAL_GAS_HEADROOM_PERCENT);
      expect(APPROVAL_GAS_HEADROOM_PERCENT).toBeGreaterThanOrEqual(25);
      expect(call.functionName).toBe("attest");
      expect(call.args).toEqual([
        {
          schema: mockEasConfig.WORK_APPROVAL.uid,
          data: expect.objectContaining({ recipient: garden, data: attestationData }),
        },
      ]);
    });
  });
});
