import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { describe, expect, it } from "vitest";
import { selectPoolCommitmentRows } from "@/views/Garden/Pool/poolCommitmentRows";

const open = commitmentFixture({ id: "open", commitmentId: 1n });
const confirmed = commitmentFixture({ id: "confirmed", commitmentId: 2n });
const past = commitmentFixture({ id: "past", commitmentId: 3n });
const model = {
  groups: { open: [open], confirmed: [confirmed], past: [past] },
  dueLive: [open],
  needsRecovery: [open, confirmed],
};
const titleOf = (row: typeof open) =>
  ({ open: "Water trees", confirmed: "Collect seeds", past: "Plant trees" })[row.id] ?? "";

describe("pool commitment row projection", () => {
  it.each([
    { scope: "open" as const, focus: null, search: "", ids: ["open"] },
    { scope: "confirmed" as const, focus: null, search: "", ids: ["confirmed"] },
    { scope: "past" as const, focus: "pastDue" as const, search: "", ids: ["open"] },
    { scope: "open" as const, focus: "recovery" as const, search: "collect", ids: ["confirmed"] },
    { scope: "open" as const, focus: null, search: "  WATER  ", ids: ["open"] },
    { scope: "open" as const, focus: null, search: "plant", ids: [] },
  ])("uses $focus/$scope with search '$search'", ({ scope, focus, search, ids }) => {
    expect(
      selectPoolCommitmentRows({ model, scope, focus, search, titleOf }).map((row) => row.id)
    ).toEqual(ids);
  });
});
