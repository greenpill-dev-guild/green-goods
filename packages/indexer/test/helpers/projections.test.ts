import assert from "node:assert/strict";
import { assertGardenProjection, assertRoleArrays } from "./projections";

describe("projection assertions", () => {
  it("reports the exact garden fact that diverged", () => {
    assert.throws(
      () => assertGardenProjection({ name: "Before" }, { name: "After" }),
      /Garden\.name|name/
    );
  });

  it("catches a mutated role-array projection", () => {
    assert.throws(
      () => assertRoleArrays({ operators: ["0x01"] }, { operators: ["0x02"] }),
      /Garden\.operators/
    );
  });
});
