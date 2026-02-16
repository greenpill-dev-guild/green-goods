import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import type { EASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import {
  buildBatchApprovalAttestTx,
  buildBatchWorkAttestTx,
} from "../../utils/eas/transaction-builder";

const mockEasConfig: EASConfig = {
  ASSESSMENT: { uid: "0x" + "1".repeat(64), schema: "" },
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
});
