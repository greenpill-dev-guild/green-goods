import { Domain } from "@green-goods/shared/types/domain";
import { describe, expect, it } from "vitest";
import {
  dirtyFieldsOf,
  draftAfterRead,
  draftFromGarden,
  landedValuesOf,
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
const read = (reading: Partial<Parameters<typeof draftAfterRead>[1]>) => ({
  garden: GARDEN,
  landed: {},
  saved: [],
  held: [],
  ...reading,
});

describe("draftAfterRead", () => {
  it("puts back every value a held save sent", () => {
    expect(
      draftAfterRead(
        draft,
        read({
          held: [
            { field: "name", value: "Tech and Sun Hub" },
            { field: "openJoining", value: false },
            { field: "maxGardeners", value: 25 },
            { field: "domains", value: [Domain.SOLAR, Domain.EDU] },
          ],
        })
      )
    ).toEqual({
      ...draft,
      name: "Tech and Sun Hub",
      openJoining: false,
      limitGardeners: true,
      maxGardeners: "25",
      domains: [Domain.SOLAR, Domain.EDU],
    });
  });

  it("takes a limit off, and leaves a new banner, whose file was not kept", () => {
    const garden = { ...GARDEN, maxGardeners: 25 };

    expect(
      draftAfterRead(
        draftFromGarden(garden),
        read({
          garden,
          held: [
            { field: "maxGardeners", value: 0 },
            { field: "banner", value: "https://example.org/new.png" },
          ],
        })
      )
    ).toEqual({ ...draftFromGarden(garden), limitGardeners: false, maxGardeners: "" });
  });

  it("brings back a banner removal, which needs no file", () => {
    expect(draftAfterRead(draft, read({ held: [{ field: "banner", value: "" }] }))).toEqual({
      ...draft,
      bannerRemoved: true,
    });
  });

  it("keeps a field the person edited while the read ran", () => {
    const edited = { ...draft, name: "Typed during the read" };

    expect(
      draftAfterRead(
        edited,
        read({
          saved: [{ field: "name", value: "Landed elsewhere" }],
          held: [{ field: "location", value: "Porto" }],
        })
      )
    ).toEqual({ ...edited, location: "Porto" });
    expect(draftAfterRead(edited, read({ held: [{ field: "name", value: "Sent" }] }))).toBe(edited);
  });

  describe("when a banner save has landed", () => {
    const sent = new File(["sent"], "sent.png", { type: "image/png" });
    const uploads = {
      uploadedUrlOf: (file: File) => (file === sent ? "https://example.org/sent.png" : null),
    };
    const landedImage = read({
      saved: [{ field: "banner", value: "https://example.org/sent.png" }],
    });

    it("clears the file that landed, so it is not sent again", () => {
      expect(draftAfterRead({ ...draft, bannerFile: sent }, landedImage, uploads)).toEqual(draft);
    });

    it("keeps a different file chosen while the read ran", () => {
      const chosen = new File(["chosen"], "chosen.png", { type: "image/png" });
      const edited = { ...draft, bannerFile: chosen };

      expect(draftAfterRead(edited, landedImage, uploads)).toEqual(edited);
    });

    it("keeps a removal staged while the read ran", () => {
      const edited = { ...draft, bannerRemoved: true };

      expect(draftAfterRead(edited, landedImage, uploads)).toEqual(edited);
    });

    it("ends a removal once that removal has landed", () => {
      expect(
        draftAfterRead(
          { ...draft, bannerRemoved: true },
          read({ saved: [{ field: "banner", value: "" }] }),
          uploads
        )
      ).toEqual(draft);
    });
  });

  it("keeps the same draft when nothing was sent, so a read causes no render", () => {
    expect(draftAfterRead(draft, read({}))).toBe(draft);
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
    expect(dirtyFieldsOf(draftAfterRead(draft, read({ saved })), GARDEN, landed)).toEqual([]);
  });
});
