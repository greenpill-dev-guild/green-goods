import { describe, expect, it } from "vitest";
import { isProtocolGarden } from "../../../hooks/commitment-pooling/useProtocolPool";

const ROOT = "0xf401f34378384713222d1d21f63359cc4e8a858a";

describe("isProtocolGarden", () => {
  it("is the garden the chain names as root, whatever the address casing", () => {
    expect(
      isProtocolGarden({
        gardenId: "0xF401F34378384713222D1D21F63359CC4E8A858A",
        rootGarden: ROOT,
        ownPoolType: null,
      })
    ).toBe(true);
  });

  it("is the garden whose own pool is the protocol pool, even when the chain read failed", () => {
    expect(isProtocolGarden({ gardenId: ROOT, rootGarden: null, ownPoolType: "PROTOCOL" })).toBe(
      true
    );
  });

  it("is no other garden, and no garden at all before one is selected", () => {
    expect(
      isProtocolGarden({
        gardenId: "0x1111111111111111111111111111111111111111",
        rootGarden: ROOT,
        ownPoolType: "GARDEN",
      })
    ).toBe(false);
    expect(isProtocolGarden({ gardenId: undefined, rootGarden: ROOT, ownPoolType: null })).toBe(
      false
    );
  });
});
