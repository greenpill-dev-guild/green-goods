/**
 * useGreenGoodsEnsName Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests protocol subdomain resolution via GreenGoodsENS.ownerToSlug.
 */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const mockReadContract = vi.fn();
const mockMulticall = vi.fn();

const ENS_ADDRESS = "0xENSContract000000000000000000000000000001";
const L1_RECEIVER_ADDRESS = "0xReceiver0000000000000000000000000000000001";
const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "ownerToSlug", type: "function", inputs: [{ name: "owner", type: "address" }] },
    { name: "l1Receiver", type: "function", inputs: [] },
  ],
  createClients: vi.fn(() => ({
    publicClient: {
      readContract: mockReadContract,
      multicall: mockMulticall,
    },
  })),
  getNetworkContracts: vi.fn(() => ({
    greenGoodsENS: ENS_ADDRESS,
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { queryKeys } from "../../../config/query-keys";
import { useGreenGoodsEnsName } from "../../../hooks/ens/useGreenGoodsEnsName";

describe("useGreenGoodsEnsName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadContract.mockReset();
    mockMulticall.mockReset();
  });

  it("returns the protocol subdomain when ownerToSlug exists", async () => {
    mockReadContract.mockResolvedValueOnce("river");

    const { result } = renderHookWithQueryClient(() => useGreenGoodsEnsName(VALID_ADDRESS));

    await waitFor(() => {
      expect(result.current.data).toBe("river.greengoods.eth");
    });
  });

  it("returns null when the address has no protocol slug", async () => {
    mockReadContract.mockResolvedValueOnce("").mockResolvedValueOnce(ZERO_ADDRESS);

    const { result } = renderHookWithQueryClient(() => useGreenGoodsEnsName(VALID_ADDRESS));

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it("falls back to the L1 receiver when the L2 cache has no owner slug", async () => {
    mockReadContract
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(L1_RECEIVER_ADDRESS)
      .mockResolvedValueOnce("river");

    const { result } = renderHookWithQueryClient(() => useGreenGoodsEnsName(VALID_ADDRESS));

    await waitFor(() => {
      expect(result.current.data).toBe("river.greengoods.eth");
    });
  });

  it("does not fetch when the ENS contract is not configured", async () => {
    const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
    (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      greenGoodsENS: ZERO_ADDRESS,
    });

    const { result } = renderHookWithQueryClient(() => useGreenGoodsEnsName(VALID_ADDRESS));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });

    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("caches by protocol name query key", async () => {
    mockReadContract.mockResolvedValueOnce("river");

    const queryClient = createTestQueryClient();
    renderHookWithQueryClient(() => useGreenGoodsEnsName(VALID_ADDRESS), { queryClient });

    await waitFor(() => {
      expect(
        queryClient.getQueryData(queryKeys.ens.protocolName(VALID_ADDRESS.toLowerCase()))
      ).toBe("river.greengoods.eth");
    });
  });

  it("retains a receiver-only name when refreshing fails, then recovers", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      queryKeys.ens.protocolName(VALID_ADDRESS.toLowerCase()),
      "river.greengoods.eth"
    );
    let unavailable = true;
    mockReadContract.mockImplementation(async ({ address, functionName }) => {
      if (functionName === "l1Receiver") return L1_RECEIVER_ADDRESS;
      if (address === ENS_ADDRESS) return "";
      if (unavailable) throw new Error("RPC unavailable");
      return "river";
    });
    const { result } = renderHookWithQueryClient(() => useGreenGoodsEnsName(VALID_ADDRESS), {
      queryClient,
    });
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBe("river.greengoods.eth");
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBe("river.greengoods.eth");
    unavailable = false;
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.data).toBe("river.greengoods.eth");
  });

  describe("in a list of people", () => {
    const RIVER = "0x1111111111111111111111111111111111111111" as const;
    const BEA = "0x2222222222222222222222222222222222222222" as const;
    const NONE = "0x3333333333333333333333333333333333333333" as const;
    // Each contract's slugs by owner: River's is on L2, Bea's only on the L1 receiver.
    const slugs: Record<string, Record<string, string>> = {
      [ENS_ADDRESS]: { [RIVER]: "river" },
      [L1_RECEIVER_ADDRESS]: { [BEA]: "bea" },
    };
    type Call = { address: string; args: [string] };

    beforeEach(() => {
      mockReadContract.mockImplementation(async ({ functionName }) =>
        functionName === "l1Receiver" ? L1_RECEIVER_ADDRESS : ""
      );
    });

    it("reads every row's name in one batch, and the rows without an L2 slug in one L1 batch", async () => {
      mockMulticall.mockImplementation(async ({ contracts }: { contracts: Call[] }) =>
        contracts.map(({ address, args }) => ({
          status: "success",
          result: slugs[address]?.[args[0]] ?? "",
        }))
      );

      const { result } = renderHookWithQueryClient(() => [
        useGreenGoodsEnsName(RIVER, { list: true }),
        useGreenGoodsEnsName(BEA, { list: true }),
        useGreenGoodsEnsName(NONE, { list: true }),
      ]);

      await waitFor(() => expect(result.current.every((name) => name.isSuccess)).toBe(true));
      expect(result.current.map((name) => name.data)).toEqual([
        "river.greengoods.eth",
        "bea.greengoods.eth",
        null,
      ]);
      // One L2 read for the three rows, one receiver read, one L1 read for the two misses.
      expect(mockMulticall).toHaveBeenCalledTimes(2);
      expect(mockMulticall.mock.calls[0][0].contracts).toHaveLength(3);
      expect(mockMulticall.mock.calls[1][0].contracts).toHaveLength(2);
      expect(mockReadContract).toHaveBeenCalledTimes(1);
    });

    it("fails only the row whose read fails, which keeps its last known name", async () => {
      mockMulticall.mockImplementation(async ({ contracts }: { contracts: Call[] }) =>
        contracts.map(({ address, args }) =>
          args[0] === BEA
            ? { status: "failure", error: new Error("RPC unavailable") }
            : { status: "success", result: slugs[address]?.[args[0]] ?? "" }
        )
      );
      const queryClient = createTestQueryClient();
      // Bea's name is known but stale, so both rows read on mount, in one batch.
      queryClient.setQueryData(queryKeys.ens.protocolName(BEA), "bea.greengoods.eth", {
        updatedAt: 1,
      });

      const { result } = renderHookWithQueryClient(
        () => [
          useGreenGoodsEnsName(RIVER, { list: true }),
          useGreenGoodsEnsName(BEA, { list: true }),
        ],
        { queryClient }
      );

      await waitFor(() => expect(result.current[1].isError).toBe(true));
      expect(mockMulticall).toHaveBeenCalledTimes(1);
      expect(result.current[1].data).toBe("bea.greengoods.eth");
      expect(result.current[0].data).toBe("river.greengoods.eth");
    });
  });
});
