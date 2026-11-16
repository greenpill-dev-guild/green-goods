/** @vitest-environment happy-dom */
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gardensKeys } from "../../../config/query-keys/garden";
import { usePrimaryAddress } from "../../../hooks/auth/usePrimaryAddress";
import { useGardenMemberContributions } from "../../../hooks/garden/useGardenMemberContributions";
import { getGardenMemberContributions } from "../../../modules/data/garden-member-contributions";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";
import { createTestQueryClient } from "../../test-utils/query-client";
import type { Address } from "../../../types/domain";

vi.mock("../../../modules/data/garden-member-contributions", () => ({
  getGardenMemberContributions: vi.fn(),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: vi.fn() }));
const account: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const viewer = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const satisfies Address;
const garden = {
  id: "0x1111111111111111111111111111111111111111",
  chainId: 42161,
  owners: [viewer],
  stewards: [] as Address[],
};
const contribution = { status: "recorded" as const, at: 1_700_000_000_000 };
const accounts = [account];
beforeEach(() => {
  vi.mocked(usePrimaryAddress).mockReturnValue(viewer);
  vi.mocked(getGardenMemberContributions)
    .mockReset()
    .mockResolvedValue({ [account]: contribution });
});
describe("useGardenMemberContributions", () => {
  it.each(["owners", "stewards"] as const)("reads for this garden's %s", async (role) => {
    const { result } = renderHookWithQueryClient(() =>
      useGardenMemberContributions({
        garden: { ...garden, owners: [], [role]: [viewer] },
        accounts,
      })
    );
    await waitFor(() => expect(result.current.byAccount[account]).toEqual(contribution));
    expect(getGardenMemberContributions).toHaveBeenCalledWith(
      { garden: garden.id, accounts, chainId: garden.chainId },
      undefined,
      expect.any(AbortSignal)
    );
  });
  it("does not read or reveal a cached date for a non-manager, including a protocol team member", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(gardensKeys.memberContributions(garden.id, accounts, garden.chainId), {
      [account]: contribution,
    });
    const { result } = renderHookWithQueryClient(
      () => useGardenMemberContributions({ garden: { ...garden, owners: [] }, accounts }),
      { queryClient }
    );
    expect(result.current).toEqual({ canView: false, byAccount: {} });
    expect(getGardenMemberContributions).not.toHaveBeenCalled();
  });
  it("masks cached dates immediately when garden or role changes", async () => {
    const { result, rerender } = renderHookWithQueryClient(
      ({ selected }) => useGardenMemberContributions({ garden: selected, accounts }),
      { initialProps: { selected: garden } }
    );
    await waitFor(() => expect(result.current.byAccount[account]).toEqual(contribution));
    vi.mocked(getGardenMemberContributions).mockClear();
    rerender({
      selected: { ...garden, id: "0x2222222222222222222222222222222222222222", owners: [] },
    });
    expect(result.current.byAccount).toEqual({});
    expect(result.current.canView).toBe(false);
    expect(getGardenMemberContributions).not.toHaveBeenCalled();
    rerender({ selected: { ...garden, owners: [] } });
    expect(result.current.byAccount).toEqual({});
  });
  it("keeps garden and chain caches separate and replaces stale data on failure", async () => {
    const { result, rerender } = renderHookWithQueryClient(
      ({ selected }) => useGardenMemberContributions({ garden: selected, accounts }),
      { initialProps: { selected: garden } }
    );
    await waitFor(() => expect(result.current.byAccount[account]).toEqual(contribution));
    vi.mocked(getGardenMemberContributions).mockRejectedValue(new Error("offline"));
    rerender({ selected: { ...garden, chainId: 11155111 } });
    expect(result.current.byAccount[account]).toEqual({ status: "loading" });
    await waitFor(() =>
      expect(result.current.byAccount[account]).toEqual({ status: "unavailable" })
    );
  });
  it("disables closed details and signed-out reads even when cached", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(gardensKeys.memberContributions(garden.id, accounts, garden.chainId), {
      [account]: contribution,
    });
    const { result, rerender } = renderHookWithQueryClient(
      ({ enabled }) => useGardenMemberContributions({ garden, accounts, enabled }),
      { queryClient, initialProps: { enabled: false } }
    );
    expect(result.current.byAccount).toEqual({});
    vi.mocked(usePrimaryAddress).mockReturnValue(null);
    rerender({ enabled: true });
    expect(result.current.byAccount).toEqual({});
    expect(getGardenMemberContributions).not.toHaveBeenCalled();
  });
});
