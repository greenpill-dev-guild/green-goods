import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { buildCommitmentMetadata } from "@green-goods/shared/modules/commitment-pooling/metadata";
import { describe, expect, it } from "vitest";
import {
  type PoolCommitmentEntry,
  selectPoolCommitmentRows,
} from "@/views/Garden/Pool/poolCommitmentRows";

const open = commitmentFixture({ id: "open", commitmentId: 1n });
const confirmed = commitmentFixture({ id: "confirmed", commitmentId: 2n });
const past = commitmentFixture({ id: "past", commitmentId: 3n });
const model = {
  groups: { open: [open], confirmed: [confirmed], past: [past] },
  dueLive: [open],
  needsRecovery: [open, confirmed],
};
const titleOf = (row: typeof open) =>
  ({ open: "Water trees", confirmed: "Collect seeds", past: "Plant trees" })[row.id] ?? "Survey";
const idOf = (entry: PoolCommitmentEntry) =>
  entry.kind === "single" ? entry.record.id : entry.displayGroupId;

describe("pool commitment row projection", () => {
  it.each([
    { scope: "open" as const, focus: null, search: "", ids: ["open"] },
    { scope: "confirmed" as const, focus: null, search: "", ids: ["confirmed"] },
    { scope: "past" as const, focus: "pastDue" as const, search: "", ids: ["open"] },
    { scope: "open" as const, focus: "recovery" as const, search: "collect", ids: ["confirmed"] },
    { scope: "open" as const, focus: null, search: "  WATER  ", ids: ["open"] },
    { scope: "open" as const, focus: null, search: "plant", ids: [] },
  ])("uses $focus/$scope with search '$search'", ({ scope, focus, search, ids }) => {
    const rows = selectPoolCommitmentRows({
      model,
      commitments: [open, confirmed, past],
      metadataByCID: new Map(),
      scope,
      focus,
      search,
      titleOf,
    });
    expect(rows.map(idOf)).toEqual(ids);
  });

  it("folds copies made together into one row that counts the whole group, while attention names each", () => {
    const survey = (id: string, commitmentId: bigint, onchainState: typeof open.onchainState) =>
      commitmentFixture({ id, commitmentId, onchainState, metadataCID: "bafy-survey" });
    const available = survey("a", 11n, "REQUESTED");
    const taken = survey("b", 12n, "ACCEPTED");
    const kept = survey("c", 13n, "FULFILLED");
    const metadataByCID = new Map([
      [
        "bafy-survey",
        buildCommitmentMetadata({
          title: "Household water survey",
          displayGroup: { version: 1, id: "group-00000001" },
        }),
      ],
    ]);
    const grouped = {
      groups: { open: [available, taken, open], confirmed: [kept], past: [] },
      dueLive: [taken],
      needsRecovery: [],
    };
    const select = (scope: "open" | "confirmed", focus: "pastDue" | null = null) =>
      selectPoolCommitmentRows({
        model: grouped,
        commitments: [available, taken, kept, open],
        metadataByCID,
        scope,
        focus,
        search: "",
        titleOf,
      });

    const [group, single] = select("open");
    expect(group).toMatchObject({
      kind: "group",
      displayGroupId: "group-00000001",
      counts: { published: 3, available: 1, inProgress: 1, kept: 1, ended: 0 },
    });
    expect(single).toEqual({ kind: "single", record: open });
    // The kept copy's scope shows the same group, with the same counts.
    expect(select("confirmed").map(idOf)).toEqual(["group-00000001"]);
    // A past-due copy surfaces on its own.
    expect(select("open", "pastDue")).toEqual([{ kind: "single", record: taken }]);
  });

  // A copy whose booking waits on the steward keeps its own row, and the group keeps its row even
  // when every copy does (Codex on #1352).
  it("keeps the group's row beside copies that stand alone, even when all of them do", () => {
    const hubDay = (id: string, commitmentId: bigint) =>
      commitmentFixture({ id, commitmentId, onchainState: "ACCEPTED", metadataCID: "bafy-hub" });
    const first = hubDay("a", 21n);
    const second = hubDay("b", 22n);
    const metadataByCID = new Map([
      [
        "bafy-hub",
        buildCommitmentMetadata({
          title: "Hub day",
          displayGroup: { version: 1, id: "group-00000002" },
        }),
      ],
    ]);
    const select = (alone: ReadonlySet<string>) =>
      selectPoolCommitmentRows({
        model: {
          groups: { open: [first, second], confirmed: [], past: [] },
          dueLive: [],
          needsRecovery: [],
        },
        commitments: [first, second],
        metadataByCID,
        scope: "open",
        focus: null,
        search: "",
        titleOf,
        standsAlone: (row) => alone.has(row.id),
      }).map(idOf);

    expect(select(new Set(["b"]))).toEqual(["group-00000002", "b"]);
    expect(select(new Set(["a", "b"]))).toEqual(["group-00000002", "a", "b"]);
  });
});
