import { describe, expect, it } from "vitest";

import { GardenTokenABI } from "../../utils/blockchain/contracts";

describe("utils/blockchain/contracts GardenToken ABI compatibility", () => {
  it("includes gardeners/operators in mintGarden config tuple", () => {
    const mintGarden = (GardenTokenABI as Array<Record<string, unknown>>).find(
      (item) => item.type === "function" && item.name === "mintGarden"
    );

    expect(mintGarden).toBeDefined();
    const inputs = (mintGarden?.inputs as Array<Record<string, unknown>>) ?? [];
    const tuple = inputs[0]?.components as Array<Record<string, string>>;
    const fieldNames = tuple.map((field) => field.name);

    expect(fieldNames).toContain("gardeners");
    expect(fieldNames).toContain("operators");
  });
});
