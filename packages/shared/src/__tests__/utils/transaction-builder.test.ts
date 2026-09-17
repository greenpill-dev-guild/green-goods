import { decodeFunctionData, encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import type { EASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import {
  buildBatchApprovalAttestTx,
  buildBatchWorkAttestTx,
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
  it("buildBatchWorkAttestTx encodes multiAttest work batch", () => {
    const tx = buildBatchWorkAttestTx(mockEasConfig, [
      {
        gardenAddress: "0x00000000000000000000000000000000000000aa",
        attestationData: ("0x" + "ab".repeat(32)) as `0x${string}`,
      },
      {
        gardenAddress: "0x00000000000000000000000000000000000000bb",
        attestationData: ("0x" + "cd".repeat(32)) as `0x${string}`,
      },
    ]);

    expect(tx.to).toBe(mockEasConfig.EAS.address);
    expect(tx.value).toBe(0n);

    const decoded = decodeFunctionData({
      abi: EASABI,
      data: tx.data,
    });

    expect(decoded.functionName).toBe("multiAttest");
    expect(Array.isArray(decoded.args?.[0])).toBe(true);
  });

  it("buildBatchWorkAttestTx rejects empty batches", () => {
    expect(() => buildBatchWorkAttestTx(mockEasConfig, [])).toThrow(
      "Works array must not be empty"
    );
  });

  it("buildBatchApprovalAttestTx rejects empty batches", () => {
    expect(() => buildBatchApprovalAttestTx(mockEasConfig, [])).toThrow(
      "Approvals array must not be empty"
    );
  });

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

    it("sends a single queued item as a plain attest", () => {
      const call = buildQueuedAttestationsCall(mockEasConfig, {
        works: [{ gardenAddress: GARDEN_A, attestationData: data("ab") }],
        approvals: [],
      });

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
      const call = buildQueuedAttestationsCall(mockEasConfig, {
        works: [
          { gardenAddress: GARDEN_A, attestationData: data("ab") },
          { gardenAddress: GARDEN_B, attestationData: data("cd") },
        ],
        approvals: [],
      });

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
      const call = buildQueuedAttestationsCall(mockEasConfig, {
        works: [{ gardenAddress: GARDEN_A, attestationData: data("ab") }],
        approvals: [{ gardenAddress: GARDEN_B, attestationData: data("ef") }],
      });

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

    it("refuses an empty send", () => {
      expect(() =>
        buildQueuedAttestationsCall(mockEasConfig, { works: [], approvals: [] })
      ).toThrow("Nothing is queued to send");
    });
  });
});
