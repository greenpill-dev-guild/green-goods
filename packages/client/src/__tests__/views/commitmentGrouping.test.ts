import { describe, expect, it } from "vitest";

import { groupByGarden } from "../../views/Home/CommitmentsDrawer/grouping";

const row = (id: string, poolId: bigint) =>
  ({ commitment: { id, poolId }, seat: "provider", needsYou: false }) as never;

const pool = (poolId: bigint, garden: string) => ({ poolId, garden }) as never;
const garden = (id: string, name: string) => ({ id, name }) as never;

describe("groupByGarden", () => {
  it("keeps two gardens that share a name apart", () => {
    const groups = groupByGarden(
      [row("a", 1n), row("b", 2n)],
      [pool(1n, "0xaaa"), pool(2n, "0xbbb")],
      [garden("0xaaa", "Riverside"), garden("0xbbb", "Riverside")]
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.gardenName === "Riverside")).toBe(true);
  });

  it("collects gardens it cannot name into one group, not one each", () => {
    // A member holding a commitment in a garden they are not in has no name for
    // it. One heading per unknown garden, all reading the same word, tells them
    // less than a single group does.
    const groups = groupByGarden(
      [row("a", 1n), row("b", 2n)],
      [pool(1n, "0xaaa"), pool(2n, "0xbbb")],
      []
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(2);
  });

  it("puts what it cannot name after the gardens it can", () => {
    const groups = groupByGarden(
      [row("a", 1n), row("b", 2n)],
      [pool(1n, "0xaaa"), pool(2n, "0xzzz")],
      [garden("0xzzz", "Zinnia")]
    );
    expect(groups.map((g) => g.gardenName)).toEqual(["Zinnia", "Other"]);
  });
});
