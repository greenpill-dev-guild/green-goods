import { describe, expect, it } from "vitest";

import {
  confirmRowKey,
  confirmRowState,
  reconcileConfirmVisit,
  selectConfirmQueueRows,
} from "../modules/commitment-pooling/confirm-queue";
import { DEMO_GARDEN, MARIA, TUNDE } from "../modules/commitment-pooling/demo/demo-builders";
import { commitmentFixture, toConfirmFixture } from "./test-utils/commitment-pooling-fixtures";

const ordinary = commitmentFixture({ commitmentId: 41n, metadataCID: "ordinary" });
const fallback = commitmentFixture({ commitmentId: 42n, metadataCID: "fallback" });
const disputed = commitmentFixture({ commitmentId: 43n, metadataCID: "disputed" });

const input = toConfirmFixture({
  groups: [
    {
      garden: TUNDE,
      gardenName: "River Garden",
      rows: [
        {
          commitment: ordinary,
          seat: "confirmer",
          needsYou: true,
          poolGarden: MARIA,
          poolGardenName: "Meadow Pool",
          canDispute: false,
        },
      ],
    },
  ],
  fallback: [
    {
      commitment: fallback,
      path: "PROTOCOL_FALLBACK",
      garden: MARIA,
      gardenName: "Protocol Garden",
      activeContributors: [],
      poolGarden: DEMO_GARDEN,
      canDispute: true,
    },
  ],
  disputed: [{ commitment: disputed, garden: DEMO_GARDEN, gardenName: "Orchard Garden" }],
});

// The Hub's read, which also lists what waits on the reader's own confirmation.
const own = commitmentFixture({ commitmentId: 44n, metadataCID: "own" });
const hubInput = {
  ...input,
  own: [{ commitment: own, garden: TUNDE, gardenName: "River Garden" }],
};

const metadata = new Map([
  ["ordinary", { title: "Repair tool handles" }],
  ["own", { title: "Water the seedlings" }],
  ["fallback", { title: "Restore the tool shed" }],
]);

describe("selectConfirmQueueRows", () => {
  it("projects ordinary, own, fallback, and disputed rows with their authority facts", () => {
    const rows = selectConfirmQueueRows({ toConfirm: hubInput, byCID: metadata, search: "" });

    expect(rows.map((row) => row.eligibility)).toEqual([
      "ORDINARY",
      "OWN",
      "PROTOCOL_FALLBACK",
      "DISPUTED",
    ]);
    expect(rows.map((row) => row.title)).toEqual([
      "Repair tool handles",
      "Water the seedlings",
      "Restore the tool shed",
      null,
    ]);
    expect(rows[0]).toMatchObject({ garden: TUNDE, poolGarden: MARIA, canDispute: false });
    // An own row lives in the pool of the garden it names, which the reader stewards.
    expect(rows[1]).toMatchObject({ garden: TUNDE, poolGarden: TUNDE, canDispute: true });
    expect(rows[3]).toMatchObject({
      garden: DEMO_GARDEN,
      poolGarden: DEMO_GARDEN,
      canDispute: true,
    });
  });

  it.each([
    ["repair", [41n]],
    [" ORCHARD ", [43n]],
    ["meadow pool", [41n]],
    ["missing", []],
  ])("filters %s by title or garden name", (search, ids) => {
    expect(
      selectConfirmQueueRows({ toConfirm: input, byCID: metadata, search }).map(
        (row) => row.commitment.commitmentId
      )
    ).toEqual(ids);
  });

  it("lets the client request only ordinary rows, never the reader's own", () => {
    expect(
      selectConfirmQueueRows({
        toConfirm: hubInput,
        byCID: metadata,
        search: "",
        include: ["ORDINARY"],
      }).map((row) => row.commitment.commitmentId)
    ).toEqual([41n]);
  });
});

describe("the confirm queue's visit", () => {
  it("keeps each row's place, adds new rows at the end, and reads a decision before the queue", () => {
    const [first, second, third] = selectConfirmQueueRows({
      toConfirm: input,
      byCID: new Map(),
      search: "",
    });
    const seen = reconcileConfirmVisit([], [first!, second!]);
    // The next read drops the first row and brings a new one ahead of the second.
    const next = reconcileConfirmVisit(seen, [third!, second!]);
    const live = new Set([third!, second!].map(confirmRowKey));

    expect(next.map((entry) => entry.row.commitment.commitmentId)).toEqual([41n, 42n, 43n]);
    expect(
      next.map((entry) =>
        confirmRowState(entry.key, {
          live,
          decisions: { [confirmRowKey(second!)]: { kind: "queued", at: 5 } },
        })
      )
    ).toEqual([{ status: "gone" }, { status: "queued", at: 5 }, { status: "waiting" }]);
  });
});
