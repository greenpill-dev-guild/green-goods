import { describe, expect, it } from "vitest";
import { handlePimlicoRpc, MOCK_PAYMASTER } from "../mocks/pimlico-handlers";

describe("Pimlico fixture protocol (no network)", () => {
  const call = (method: string) => handlePimlicoRpc({ jsonrpc: "2.0", id: 7, method, params: [] });
  it("returns gas price tiers", () =>
    expect(call("pimlico_getUserOperationGasPrice")).toMatchObject({
      id: 7,
      result: { slow: expect.any(Object), fast: expect.any(Object) },
    }));
  it("returns estimation fields", () =>
    expect(call("eth_estimateUserOperationGas")).toMatchObject({
      result: { preVerificationGas: expect.any(String), verificationGasLimit: expect.any(String) },
    }));
  it("returns the fixture sponsor", () =>
    expect(call("pm_sponsorUserOperation")).toMatchObject({
      result: { paymaster: MOCK_PAYMASTER },
    }));
  it("rejects unsupported methods", () =>
    expect(call("unknown_method")).toMatchObject({ error: { code: -32601 } }));
});
