import { describe, expect, it } from "vitest";

import {
  buildCommitmentMetadata,
  COMMITMENT_METADATA_VERSION,
  isResolvableMetadataCID,
  parseCommitmentMetadata,
} from "../modules/commitment-pooling/metadata";
import {
  buildCommitmentCreationPayload,
  COMMITMENT_COMPOSER_DEFAULTS,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "../types/domain";

describe("commitment metadata", () => {
  it("keeps a title to one line so a pasted paragraph cannot break a row", () => {
    expect(buildCommitmentMetadata({ title: "Compost\n\n  workshop " }).title).toBe(
      "Compost workshop"
    );
  });

  it("refuses to publish a commitment with no name", () => {
    expect(() => buildCommitmentMetadata({ title: "   " })).toThrow();
  });

  // The write limits and the read tolerance side by side: metadata written
  // before the limits, longer than anyone can write today, still reads whole.
  const text = (length: number) => "x".repeat(length);
  it.each([
    { label: "a 60-character title", field: "title", length: 60, written: 60, read: 60 },
    { label: "a 61-character title", field: "title", length: 61, written: "refused", read: 61 },
    { label: "a 121-character title", field: "title", length: 121, written: "refused", read: 120 },
    { label: "a 280-character note", field: "note", length: 280, written: 280, read: 280 },
    { label: "a 281-character note", field: "note", length: 281, written: "refused", read: 281 },
    {
      label: "a 2,001-character note",
      field: "note",
      length: 2001,
      written: "refused",
      read: 2000,
    },
  ] as const)("writes and reads $label", ({ field, length, written, read }) => {
    const words =
      field === "title" ? { title: text(length) } : { title: "Rides", note: text(length) };
    const write = () => buildCommitmentMetadata(words)[field]?.length;
    if (written === "refused") expect(write).toThrow(`${field} can be at most`);
    else expect(write()).toBe(written);
    expect(parseCommitmentMetadata({ version: 1, ...words })?.[field]?.length).toBe(read);
  });

  it("omits an absent note rather than writing an empty one", () => {
    expect(buildCommitmentMetadata({ title: "Rides" })).toEqual({
      version: COMMITMENT_METADATA_VERSION,
      title: "Rides",
    });
    expect(buildCommitmentMetadata({ title: "Rides", note: "  " })).not.toHaveProperty("note");
  });

  it("reads back what it wrote", () => {
    const written = buildCommitmentMetadata({ title: "Rides", note: "To the market" });
    expect(parseCommitmentMetadata(written)).toEqual(written);
  });

  it("returns null rather than throwing on anything unusable", () => {
    // A commitment whose caption is missing is still real and still binding, so
    // the screen has to keep rendering.
    for (const junk of [null, undefined, 42, "a string", {}, { title: "" }, { title: 7 }]) {
      expect(parseCommitmentMetadata(junk)).toBeNull();
    }
  });

  it("keeps an unknown version rather than discarding a readable title", () => {
    expect(parseCommitmentMetadata({ version: 99, title: "Rides" })).toEqual({
      version: 99,
      title: "Rides",
    });
  });

  it("spends a request only on a CID that could resolve", () => {
    expect(isResolvableMetadataCID("bafy...")).toBe(true);
    for (const empty of [null, undefined, "", "   ", "0", "-"]) {
      expect(isResolvableMetadataCID(empty)).toBe(false);
    }
  });
});

describe("composer metadata handoff", () => {
  const payload = () =>
    buildCommitmentCreationPayload({
      values: {
        ...COMMITMENT_COMPOSER_DEFAULTS,
        title: "Compost workshop",
        note: "Two hours on Saturday",
        unitLabel: "hours",
        targetUnits: 2,
      },
      clientCommitmentId: "draft-1",
      poolId: 7n,
      creator: "0x1111111111111111111111111111111111111111" as Address,
      gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
      nowSeconds: 1_700_000_000,
    });

  it("carries the words instead of a CID, so composing works with no signal", () => {
    const built = payload();
    expect(built.metadataCID).toBe("");
    expect(built.metadata).toEqual({
      version: COMMITMENT_METADATA_VERSION,
      title: "Compost workshop",
      note: "Two hours on Saturday",
    });
  });

  it("stays a pure function, so the same draft always hashes the same", () => {
    expect(payload()).toEqual(payload());
  });
});

describe("commitment metadata v1 note and links", () => {
  it("writes the note and links under the schema's names", () => {
    expect(
      buildCommitmentMetadata({
        title: "Prune",
        note: "  Bring  gloves ",
        links: [{ url: "https://example.org/plan", label: "Plan" }],
      })
    ).toEqual({
      version: 1,
      title: "Prune",
      note: "Bring gloves",
      links: [{ url: "https://example.org/plan", label: "Plan" }],
    });
  });

  it("reads a note, and still reads the older description field as the note", () => {
    expect(
      parseCommitmentMetadata({ version: 1, title: "Prune", note: "Bring gloves" })?.note
    ).toBe("Bring gloves");
    expect(
      parseCommitmentMetadata({ version: 1, title: "Prune", description: "Bring gloves" })?.note
    ).toBe("Bring gloves");
  });

  it("drops links that are not web addresses rather than failing the whole document", () => {
    expect(
      parseCommitmentMetadata({
        version: 1,
        title: "Prune",
        links: [{ url: "https://example.org/a" }, { url: "javascript:alert(1)" }, { url: 5 }],
      })?.links
    ).toEqual([{ url: "https://example.org/a" }]);
  });
});
