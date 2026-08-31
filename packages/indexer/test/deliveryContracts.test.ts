import assert from "node:assert/strict";
import { assertConvergesUnderDelivery, assertRelationshipInEitherOrder } from "./helpers/delivery";

describe("delivery contract helpers", () => {
  it("accepts a reducer that converges under reorder and replay", async () => {
    await assertConvergesUnderDelivery({
      events: { addOne: 1, addTwo: 2, replayOne: 1 },
      orders: [
        ["addOne", "addTwo", "replayOne"],
        ["addTwo", "replayOne", "addOne"],
      ],
      read: async (events) => [...new Set(events)].sort(),
    });
  });

  it("catches a non-converging reducer", async () => {
    await assert.rejects(() =>
      assertConvergesUnderDelivery({
        events: { first: "first", second: "second" },
        orders: [
          ["first", "second"],
          ["second", "first"],
        ],
        read: async (events) => events.join(" -> "),
      })
    );
  });

  it("proves a relationship and entity converge in either order", async () => {
    const [relationshipFirst] = await assertRelationshipInEitherOrder({
      relationship: { kind: "relationship", id: 1 },
      entity: { kind: "entity", id: 1 },
      read: async (events) => ({ ids: events.map((event) => event.id).sort() }),
    });
    assert.deepEqual(relationshipFirst, { ids: [1, 1] });
  });
});
