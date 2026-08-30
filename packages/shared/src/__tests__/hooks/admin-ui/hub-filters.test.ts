import { createMockWork } from "@green-goods/shared/testing";
import { describe, expect, it } from "vitest";
import { filterAssessmentQueue, filterPendingWorks } from "../../../hooks/admin-ui/hub/hub.filters";

describe("Hub work queue filters", () => {
  it("moves only the reviewed work out of pending and into its next state", () => {
    const reviewed = createMockWork({ id: "reviewed", createdAt: 2, status: "pending" });
    const unrelated = createMockWork({ id: "unrelated", createdAt: 1, status: "pending" });
    const actions = new Map();

    const reconciled = [{ ...reviewed, status: "approved" as const }, unrelated];

    expect(filterPendingWorks(reconciled, actions, "", "newest")).toEqual([unrelated]);
    expect(filterAssessmentQueue(reconciled, actions, "")).toEqual([
      expect.objectContaining({ id: reviewed.id, status: "approved" }),
    ]);
  });
});
