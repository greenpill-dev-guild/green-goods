import { describe, expect, it } from "vitest";

import { parseCycleMetadata } from "../modules/commitment-pooling/cycle-metadata";

describe("cycle metadata", () => {
  it("accepts the versioned public name contract", () => {
    expect(parseCycleMetadata({ version: 1, name: "  Rainy   Season  " })).toEqual({
      version: 1,
      name: "Rainy Season",
    });
  });

  it("fails closed when a metadata document has no usable name", () => {
    expect(parseCycleMetadata({ version: 1, title: "Not the frozen field" })).toBeNull();
    expect(parseCycleMetadata({ version: 1, name: "   " })).toBeNull();
    expect(parseCycleMetadata(null)).toBeNull();
  });
});
