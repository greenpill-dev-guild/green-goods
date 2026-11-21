/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";

import type { Address } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const OWNER = "0x2222222222222222222222222222222222222222" as Address;

const mocks = vi.hoisted(() => ({ readGardenRoleHat: vi.fn() }));

vi.mock("../../../utils/blockchain/garden-role-reads", () => ({
  readGardenRoleHat: mocks.readGardenRoleHat,
}));

const { useSubRoleCheck } = await import("../../../hooks/garden/useSubRoleCheck");

describe("useSubRoleCheck", () => {
  it("keeps only the roles the chain shows missing, reading fresh past a cached answer", async () => {
    const queryClient = createTestQueryClient();
    mocks.readGardenRoleHat.mockImplementation(async (_g, _a, role) => role === "gardener");
    const { result } = renderHookWithQueryClient(() => useSubRoleCheck(GARDEN, 42161), {
      queryClient,
    });

    await expect(result.current(OWNER, ["evaluator", "gardener"])).resolves.toEqual(["evaluator"]);

    // The indexer lagged: another tab restored Evaluator, so nothing is left to send.
    mocks.readGardenRoleHat.mockResolvedValue(true);
    await expect(result.current(OWNER, ["evaluator"])).resolves.toEqual([]);
    expect(mocks.readGardenRoleHat).toHaveBeenLastCalledWith(GARDEN, OWNER, "evaluator", 42161);
  });

  it("answers null when a read fails, so nothing is sent on a guess", async () => {
    mocks.readGardenRoleHat.mockRejectedValue(new Error("rpc down"));
    const { result } = renderHookWithQueryClient(() => useSubRoleCheck(GARDEN, 42161), {
      queryClient: createTestQueryClient(),
    });

    await expect(result.current(OWNER, ["evaluator"])).resolves.toBeNull();
  });
});
