import { describe, expect, it } from "vitest";
import { STALE_TIMES } from "../../../config/react-query";
import { gardenWorkListQuery, workSessionStartedAt } from "../../../hooks/work/gardenWorkListQuery";
import { createTestQueryClient } from "../../test-utils/query-client";

const GARDEN = "0x1111111111111111111111111111111111111111";

function staleTimeFor(dataUpdatedAt: number) {
  const { staleTime } = gardenWorkListQuery(createTestQueryClient(), GARDEN, 11155111);
  const query = { state: { dataUpdatedAt } } as Parameters<typeof staleTime>[0];
  return staleTime(query);
}

describe("gardenWorkListQuery", () => {
  it("reads a garden again when its rows were restored from an earlier session", () => {
    // Restored a moment before this session began, the rows are still within
    // the usual stale window, yet only a read in this session can prove a stall.
    const sessionStart = workSessionStartedAt();
    expect(staleTimeFor(sessionStart - 1)).toBe(0);
    expect(staleTimeFor(sessionStart + 1)).toBe(STALE_TIMES.works);
  });
});
