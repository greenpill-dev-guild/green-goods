/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";

import { roleKeys } from "../../../config/query-keys/identity";
import type { Address } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const OWNER = "0x2222222222222222222222222222222222222222" as Address;

const mocks = vi.hoisted(() => ({ readGardenRoleHat: vi.fn(), getGardenMemberHistory: vi.fn() }));

vi.mock("../../../utils/blockchain/garden-role-reads", () => ({
  readGardenRoleHat: mocks.readGardenRoleHat,
}));
vi.mock("../../../modules/data/garden-member-history", () => ({
  getGardenMemberHistory: mocks.getGardenMemberHistory,
}));

const historyRow = (recordedRoles: string[] | undefined) => [
  { garden: GARDEN, account: OWNER, joinedAt: 1, memberSince: 1, roleSince: {}, recordedRoles },
];

const { useSubRoleCheck } = await import("../../../hooks/garden/useSubRoleCheck");

describe("useSubRoleCheck", () => {
  it("answers what the chain lacks and what the history records, both read fresh", async () => {
    const queryClient = createTestQueryClient();
    mocks.readGardenRoleHat.mockImplementation(async (_g, _a, role) => role === "gardener");
    mocks.getGardenMemberHistory.mockResolvedValue(historyRow(["steward"]));
    const { result } = renderHookWithQueryClient(() => useSubRoleCheck(GARDEN, 42161), {
      queryClient,
    });

    await expect(result.current(OWNER, ["evaluator", "gardener"])).resolves.toEqual({
      lacking: ["evaluator"],
      recordedRoles: ["steward"],
    });

    // Since the first press another tab restored Evaluator and an Owner grant came and went.
    mocks.readGardenRoleHat.mockResolvedValue(true);
    mocks.getGardenMemberHistory.mockResolvedValue(historyRow(["owner", "steward"]));
    await expect(result.current(OWNER, ["evaluator"])).resolves.toEqual({
      lacking: [],
      recordedRoles: ["owner", "steward"],
    });
    expect(mocks.readGardenRoleHat).toHaveBeenLastCalledWith(GARDEN, OWNER, "evaluator", 42161);
    expect(mocks.getGardenMemberHistory).toHaveBeenLastCalledWith(
      { garden: GARDEN, account: OWNER, chainId: 42161 },
      undefined,
      expect.anything()
    );
  });

  it("answers null when a read fails or the history has no row, so nothing is sent on a guess", async () => {
    mocks.readGardenRoleHat.mockRejectedValue(new Error("rpc down"));
    mocks.getGardenMemberHistory.mockResolvedValue(historyRow(["steward"]));
    const { result } = renderHookWithQueryClient(() => useSubRoleCheck(GARDEN, 42161), {
      queryClient: createTestQueryClient(),
    });

    await expect(result.current(OWNER, ["evaluator"])).resolves.toBeNull();

    mocks.readGardenRoleHat.mockResolvedValue(false);
    mocks.getGardenMemberHistory.mockRejectedValue(new Error("indexer down"));
    await expect(result.current(OWNER, ["evaluator"])).resolves.toBeNull();

    mocks.getGardenMemberHistory.mockResolvedValue([]);
    await expect(result.current(OWNER, ["evaluator"])).resolves.toBeNull();

    mocks.getGardenMemberHistory.mockResolvedValue(historyRow(undefined));
    await expect(result.current(OWNER, ["evaluator"])).resolves.toBeNull();
  });

  it("reads nothing without a garden, and answers null so nothing is sent", async () => {
    mocks.readGardenRoleHat.mockClear();
    const { result } = renderHookWithQueryClient(() => useSubRoleCheck(undefined, 42161), {
      queryClient: createTestQueryClient(),
    });

    await expect(result.current(OWNER, ["gardener"])).resolves.toBeNull();
    expect(mocks.readGardenRoleHat).not.toHaveBeenCalled();
  });

  it("leaves the fresh answer where the row's own role-hat reads find it", async () => {
    const queryClient = createTestQueryClient();
    mocks.readGardenRoleHat.mockResolvedValue(false);
    mocks.getGardenMemberHistory.mockResolvedValue(historyRow(["steward"]));
    const { result } = renderHookWithQueryClient(() => useSubRoleCheck(GARDEN, 42161), {
      queryClient,
    });

    await result.current(OWNER, ["evaluator"]);

    expect(
      queryClient.getQueryData(
        roleKeys.roleHat(GARDEN.toLowerCase(), OWNER.toLowerCase(), "evaluator", 42161)
      )
    ).toBe(false);
  });
});
