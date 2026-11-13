/** @vitest-environment happy-dom */
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { gardensKeys } from "../../../config/query-keys/garden";
import { useGardenMemberHistory } from "../../../hooks/garden/useGardenMemberHistory";
import { getGardenMemberHistory } from "../../../modules/data/garden-member-history";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";
import { createTestQueryClient } from "../../test-utils/query-client";

vi.mock("../../../modules/data/garden-member-history", () => ({ getGardenMemberHistory: vi.fn() }));
const garden = "0x1111111111111111111111111111111111111111";
const account = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useGardenMemberHistory", () => {
  it("does not request chain-wide history without a garden or account", () => {
    vi.mocked(getGardenMemberHistory).mockClear();
    const { result } = renderHookWithQueryClient(() => useGardenMemberHistory({}));
    expect(getGardenMemberHistory).not.toHaveBeenCalled();
    expect(result.current.members).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("refreshes garden dates when the existing garden invalidation fires", async () => {
    const read = vi.mocked(getGardenMemberHistory).mockReset();
    const first = {
      garden,
      account,
      joinedAt: 1000,
      memberSince: 1000,
      roleSince: { gardener: 1000 },
    };
    read.mockResolvedValueOnce([first]).mockResolvedValueOnce([{ ...first, memberSince: 3000 }]);
    const queryClient = createTestQueryClient();
    const { result } = renderHookWithQueryClient(
      () => useGardenMemberHistory({ garden, chainId: 42161 }),
      { queryClient }
    );
    await waitFor(() => expect(result.current.members[0]?.memberSince).toBe(1000));
    await queryClient.invalidateQueries({ queryKey: gardensKeys.byChain(42161) });
    await waitFor(() => expect(result.current.members[0]?.memberSince).toBe(3000));
  });

  it("does not reuse another chain or account's cached membership dates", async () => {
    const read = vi.mocked(getGardenMemberHistory).mockReset().mockResolvedValue([]);
    const { rerender } = renderHookWithQueryClient(
      ({ chainId, who }) => useGardenMemberHistory({ account: who, chainId }),
      {
        initialProps: { chainId: 42161, who: account as `0x${string}` },
      }
    );
    await waitFor(() =>
      expect(read).toHaveBeenCalledWith(
        { account, garden: undefined, chainId: 42161 },
        undefined,
        expect.any(AbortSignal)
      )
    );
    rerender({ chainId: 11155111, who: garden });
    await waitFor(() =>
      expect(read).toHaveBeenCalledWith(
        { account: garden, garden: undefined, chainId: 11155111 },
        undefined,
        expect.any(AbortSignal)
      )
    );
  });

  it("reports unavailable history instead of inventing dates", async () => {
    vi.mocked(getGardenMemberHistory)
      .mockReset()
      .mockRejectedValue(new Error("schema not deployed"));
    const { result } = renderHookWithQueryClient(() => useGardenMemberHistory({ garden }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.members).toEqual([]);
  });
});
