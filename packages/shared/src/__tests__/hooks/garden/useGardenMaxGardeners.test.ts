/**
 * @vitest-environment jsdom
 */

import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { gardensKeys } from "../../../config/query-keys/garden";
import type { Address } from "../../../types/domain";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;

const mocks = vi.hoisted(() => ({ readContract: vi.fn() }));

vi.mock("@wagmi/core", () => ({ readContract: mocks.readContract }));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));

const { useGardenMaxGardeners } = await import("../../../hooks/garden/useGardenMaxGardeners");

describe("useGardenMaxGardeners", () => {
  it("reads the cap from the garden's account, and again once a saved cap refreshes the gardens", async () => {
    mocks.readContract.mockResolvedValueOnce(25n).mockResolvedValueOnce(30n);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHookWithQueryClient(() => useGardenMaxGardeners(GARDEN, 42161), {
      queryClient,
    });

    await waitFor(() => expect(result.current.data).toBe(25));
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: GARDEN, functionName: "maxGardeners", chainId: 42161 })
    );

    // What useSetMaxGardeners invalidates once a new cap lands.
    await queryClient.invalidateQueries({ queryKey: gardensKeys.all });

    await waitFor(() => expect(result.current.data).toBe(30));
  });
});
