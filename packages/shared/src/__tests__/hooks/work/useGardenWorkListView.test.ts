/**
 * The garden Work tab's Type and Sort (selectGardenWorkList): which of the
 * garden's actions it offers, what each shows, and the three orders.
 */

import { describe, expect, it } from "vitest";
import { selectGardenWorkList } from "../../../hooks/work/useGardenWorkListView";
import { createMockAction, createMockWork } from "../../test-utils/mock-factories";

const ACTIONS = [
  createMockAction({ id: "42161-3", title: "Weeding" }),
  createMockAction({ id: "42161-1", title: "Planting" }),
  createMockAction({ id: "42161-2", title: "Composting" }),
  // An action nobody has done here yet.
  createMockAction({ id: "42161-4", title: "Harvesting" }),
];
const WORKS = [
  createMockWork({ id: "a", actionUID: 1, status: "approved", createdAt: 400 }),
  createMockWork({ id: "b", actionUID: 3, status: "pending", createdAt: 100 }),
  createMockWork({ id: "c", actionUID: 1, status: "pending", createdAt: 300 }),
  createMockWork({ id: "d", actionUID: 2, status: "rejected", createdAt: 200 }),
];
const ids = (view: ReturnType<typeof selectGardenWorkList>) => view.works.map((work) => work.id);

describe("selectGardenWorkList", () => {
  it("offers the garden's actions that have work here, A to Z, and leaves out the rest", () => {
    const view = selectGardenWorkList(WORKS, ACTIONS, { type: "all", sort: "pending" });

    expect(view.typeOptions).toEqual([
      { id: "2", title: "Composting" },
      { id: "1", title: "Planting" },
      { id: "3", title: "Weeding" },
    ]);
    expect(view.actionById.get("3")?.title).toBe("Weeding");
  });

  it("orders pending work first by default, newest first within each group", () => {
    const view = selectGardenWorkList(WORKS, ACTIONS, { type: "all", sort: "pending" });
    expect(ids(view)).toEqual(["c", "b", "a", "d"]);
  });

  it("orders newest first or oldest first when asked", () => {
    expect(ids(selectGardenWorkList(WORKS, ACTIONS, { type: "all", sort: "newest" }))).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
    expect(ids(selectGardenWorkList(WORKS, ACTIONS, { type: "all", sort: "oldest" }))).toEqual([
      "b",
      "d",
      "c",
      "a",
    ]);
  });

  it("shows one action's work when a type is chosen, still in the chosen order", () => {
    const view = selectGardenWorkList(WORKS, ACTIONS, { type: "1", sort: "oldest" });
    expect(view.type).toBe("1");
    expect(ids(view)).toEqual(["c", "a"]);
  });

  it("falls back to all work when the chosen type has nothing left in it", () => {
    // Harvesting has no work, so it is never an option and never empties the list.
    const view = selectGardenWorkList(WORKS, ACTIONS, { type: "4", sort: "pending" });
    expect(view.type).toBe("all");
    expect(view.works).toHaveLength(4);
  });
});
