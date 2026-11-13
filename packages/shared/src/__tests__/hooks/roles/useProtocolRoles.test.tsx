/** @vitest-environment happy-dom */
import { cleanup, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";
import { useProtocolRoles } from "../../../hooks/roles/useProtocolRoles";
import { roleKeys } from "../../../config/query-keys/identity";

const mocks = vi.hoisted(() => ({
  account: "0x1111111111111111111111111111111111111111",
  chain: 42161,
  read: vi.fn(),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.account,
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => mocks.chain }));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../../config/blockchain", () => ({
  getNetworkConfig: () => ({
    contracts: { hatsModule: "0x2222222222222222222222222222222222222222" },
  }),
}));
vi.mock("@wagmi/core", () => ({ readContract: (...args: unknown[]) => mocks.read(...args) }));

let client: ReturnType<typeof createTestQueryClient>;
beforeEach(() => {
  client = createTestQueryClient();
  mocks.account = "0x1111111111111111111111111111111111111111";
  mocks.chain = 42161;
  mocks.read.mockReset().mockImplementation(async (_config, call) => {
    if (call.functionName === "protocolRoleHats") return [1n, 2n, 3n, 4n];
    if (call.functionName === "hats") return "0x3333333333333333333333333333333333333333";
    return call.args[1] === 1n;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe("effective protocol Hat membership", () => {
  it("reads each role independently for the signing account on the selected chain", async () => {
    const { result } = renderHookWithQueryClient(useProtocolRoles, { queryClient: client });
    await waitFor(() => expect(result.current.team).toBe(true));
    expect(result.current).toMatchObject({ productLead: false, agents: false, deployer: false });
    const membershipCalls = mocks.read.mock.calls
      .map(([, call]) => call)
      .filter((call) => call.functionName === "isWearerOfHat");
    expect(membershipCalls).toHaveLength(4);
    expect(
      membershipCalls.every((call) => call.chainId === 42161 && call.args[0] === mocks.account)
    ).toBe(true);
  });

  it("denies retained permissions when a fresh membership read fails", async () => {
    const { result } = renderHookWithQueryClient(useProtocolRoles, { queryClient: client });
    await waitFor(() => expect(result.current.team).toBe(true));
    mocks.read.mockRejectedValue(new Error("RPC unavailable"));
    await act(async () => {
      await client.invalidateQueries({
        queryKey: roleKeys.protocolRoles(mocks.account, mocks.chain),
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.team).toBe(false);
  });

  it("does not carry an Arbitrum role into another chain", async () => {
    const { result, rerender } = renderHookWithQueryClient(useProtocolRoles, {
      queryClient: client,
    });
    await waitFor(() => expect(result.current.team).toBe(true));
    mocks.chain = 100;
    mocks.read.mockImplementation(async (_config, call) => {
      if (call.functionName === "protocolRoleHats") return [0n, 0n, 0n, 0n];
      return "0x3333333333333333333333333333333333333333";
    });
    rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.team).toBe(false);
  });

  it("does not retain Team authority when the signing account changes", async () => {
    const { result, rerender } = renderHookWithQueryClient(useProtocolRoles, {
      queryClient: client,
    });
    await waitFor(() => expect(result.current.team).toBe(true));
    mocks.account = "0x4444444444444444444444444444444444444444";
    mocks.read.mockImplementation(async (_config, call) => {
      if (call.functionName === "protocolRoleHats") return [1n, 2n, 3n, 4n];
      if (call.functionName === "hats") return "0x3333333333333333333333333333333333333333";
      return false;
    });
    rerender();
    expect(result.current.team).toBe(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      team: false,
      productLead: false,
      agents: false,
      deployer: false,
    });
  });
});
