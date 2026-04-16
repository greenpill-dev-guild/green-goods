/**
 * useGreenGoodsEnsName Hook Tests
 * @vitest-environment jsdom
 *
 * Tests protocol subdomain resolution via GreenGoodsENS.ownerToSlug.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadContract = vi.fn();

const ENS_ADDRESS = "0xENSContract000000000000000000000000000001";
const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "ownerToSlug", type: "function", inputs: [{ name: "owner", type: "address" }] },
  ],
  createClients: vi.fn(() => ({
    publicClient: {
      readContract: mockReadContract,
    },
  })),
  getNetworkContracts: vi.fn(() => ({
    greenGoodsENS: ENS_ADDRESS,
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

import { queryKeys } from "../../../config/query-keys";
import { useGreenGoodsEnsName } from "../../../hooks/ens/useGreenGoodsEnsName";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe("useGreenGoodsEnsName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the protocol subdomain when ownerToSlug exists", async () => {
    mockReadContract.mockResolvedValueOnce("river");

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGreenGoodsEnsName(VALID_ADDRESS), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBe("river.greengoods.eth");
    });
  });

  it("returns null when the address has no protocol slug", async () => {
    mockReadContract.mockResolvedValueOnce("");

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGreenGoodsEnsName(VALID_ADDRESS), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it("does not fetch when the ENS contract is not configured", async () => {
    const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
    (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      greenGoodsENS: ZERO_ADDRESS,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGreenGoodsEnsName(VALID_ADDRESS), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });

    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("caches by protocol name query key", async () => {
    mockReadContract.mockResolvedValueOnce("river");

    const { queryClient, wrapper } = createWrapper();
    renderHook(() => useGreenGoodsEnsName(VALID_ADDRESS), { wrapper });

    await waitFor(() => {
      expect(
        queryClient.getQueryData(queryKeys.ens.protocolName(VALID_ADDRESS.toLowerCase()))
      ).toBe("river.greengoods.eth");
    });
  });
});
