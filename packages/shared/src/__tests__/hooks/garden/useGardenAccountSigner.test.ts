/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const OWNER = "0x9e1b000000000000000000000000000000c7f0aa" as const;
const CONNECTED = "0x2222222222222222222222222222222222222222" as const;
// bytes4(keccak256("isValidSigner(address,bytes)")), the ERC-6551 magic value.
const VALID_SIGNER = "0x523e3260";

const mocks = vi.hoisted(() => ({
  primaryAddress: null as string | null,
  reads: undefined as unknown,
  lastContracts: [] as Array<{ functionName: string; args?: readonly unknown[] }>,
}));

vi.mock("wagmi", () => ({
  useReadContracts: (params: { contracts: typeof mocks.lastContracts }) => {
    mocks.lastContracts = params.contracts;
    return { data: mocks.reads, isLoading: false };
  },
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.primaryAddress,
}));

const { useGardenAccountSigner } = await import("../../../hooks/garden/useGardenAccountSigner");

describe("useGardenAccountSigner", () => {
  beforeEach(() => {
    mocks.primaryAddress = CONNECTED;
    mocks.reads = undefined;
  });

  it("lets the account sign when the garden account answers with the ERC-6551 magic value", () => {
    mocks.reads = [
      { status: "success", result: OWNER },
      { status: "success", result: VALID_SIGNER },
    ];

    const { result } = renderHook(() => useGardenAccountSigner(GARDEN));

    expect(mocks.lastContracts.map((call) => call.functionName)).toEqual([
      "owner",
      "isValidSigner",
    ]);
    expect(mocks.lastContracts[1].args).toEqual([CONNECTED, "0x"]);
    expect(result.current).toMatchObject({ canSign: true, isResolved: true, owner: OWNER });
  });

  it("names the owner when the connected account cannot sign", () => {
    mocks.reads = [
      { status: "success", result: OWNER },
      { status: "success", result: "0x00000000" },
    ];

    const { result } = renderHook(() => useGardenAccountSigner(GARDEN));

    expect(result.current).toMatchObject({ canSign: false, isResolved: true, owner: OWNER });
  });

  it("stays unresolved, and closed, until the chain has answered", () => {
    mocks.reads = [
      { status: "success", result: OWNER },
      { status: "failure", error: new Error("rpc") },
    ];

    const { result } = renderHook(() => useGardenAccountSigner(GARDEN));

    expect(result.current).toMatchObject({ canSign: false, isResolved: false });
  });
});
