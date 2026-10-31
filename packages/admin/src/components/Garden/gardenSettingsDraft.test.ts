import { Domain } from "@green-goods/shared/types/domain";
import { describe, expect, it } from "vitest";
import {
  dirtyFieldsOf,
  draftFromGarden,
  landedValuesOf,
  withSentValues,
} from "./gardenSettingsDraft";

const GARDEN = {
  name: "Tech and Sun",
  description: "Solar work.",
  location: "Lisbon",
  bannerImage: "https://example.org/banner.png",
  domainMask: 1,
  openJoining: true,
  maxGardeners: 0,
};
const draft = draftFromGarden(GARDEN);

describe("withSentValues", () => {
  it("puts back every value a save sent", () => {
    expect(
      withSentValues(draft, [
        { field: "name", value: "Tech and Sun Hub" },
        { field: "openJoining", value: false },
        { field: "maxGardeners", value: 25 },
        { field: "domains", value: [Domain.SOLAR, Domain.EDU] },
      ])
    ).toEqual({
      ...draft,
      name: "Tech and Sun Hub",
      openJoining: false,
      limitGardeners: true,
      maxGardeners: "25",
      domains: [Domain.SOLAR, Domain.EDU],
    });
  });

  it("takes a limit off, and leaves the banner, whose file was not kept", () => {
    const capped = { ...draft, limitGardeners: true, maxGardeners: "25" };

    expect(
      withSentValues(capped, [
        { field: "maxGardeners", value: 0 },
        { field: "banner", value: "https://example.org/new.png" },
      ])
    ).toEqual({ ...capped, limitGardeners: false, maxGardeners: "" });
  });

  it("keeps the same draft when nothing was sent, so a read causes no render", () => {
    expect(withSentValues(draft, [])).toBe(draft);
  });
});

describe("landedValuesOf", () => {
  it("keeps a saved value out of the next save until the garden reports it", () => {
    const saved = [
      { field: "name", value: "Tech and Sun Hub" },
      { field: "maxGardeners", value: 25 },
      { field: "domains", value: [Domain.EDU, Domain.SOLAR] },
      { field: "banner", value: "https://example.org/new.png" },
    ] as const;

    const landed = landedValuesOf(saved);

    expect(landed).not.toHaveProperty("banner");
    expect(dirtyFieldsOf(withSentValues(draft, saved), GARDEN, landed)).toEqual([]);
  });
});
