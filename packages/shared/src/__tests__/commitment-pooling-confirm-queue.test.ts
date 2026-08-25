import { describe, expect, it } from "vitest";

import { selectConfirmQueueRows } from "../modules/commitment-pooling/confirm-queue";
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

const metadata = new Map([
  ["ordinary", { title: "Repair tool handles" }],
  ["fallback", { title: "Restore the tool shed" }],
]);

describe("selectConfirmQueueRows", () => {
  it("projects ordinary, fallback, and disputed rows with their authority facts", () => {
    const rows = selectConfirmQueueRows({ toConfirm: input, byCID: metadata, search: "" });

    expect(rows.map((row) => row.eligibility)).toEqual([
      "ORDINARY",
      "PROTOCOL_FALLBACK",
      "DISPUTED",
    ]);
    expect(rows.map((row) => row.title)).toEqual([
      "Repair tool handles",
      "Restore the tool shed",
      null,
    ]);
    expect(rows[0]).toMatchObject({ garden: TUNDE, poolGarden: MARIA, canDispute: false });
    expect(rows[2]).toMatchObject({
      garden: DEMO_GARDEN,
      poolGarden: DEMO_GARDEN,
      canDispute: true,
    });
  });

  it.each([
    ["repair", [41n]],
    [" ORCHARD ", [43n]],
    ["missing", []],
  ])("filters %s by title or garden name", (search, ids) => {
    expect(
      selectConfirmQueueRows({ toConfirm: input, byCID: metadata, search }).map(
        (row) => row.commitment.commitmentId
      )
    ).toEqual(ids);
  });

  it("lets the client request only ordinary rows", () => {
    expect(
      selectConfirmQueueRows({
        toConfirm: input,
        byCID: metadata,
        search: "",
        include: ["ORDINARY"],
      }).map((row) => row.commitment.commitmentId)
    ).toEqual([41n]);
  });
});
