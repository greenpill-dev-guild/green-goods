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

  it("omits an absent description rather than writing an empty one", () => {
    expect(buildCommitmentMetadata({ title: "Rides" })).toEqual({
      version: COMMITMENT_METADATA_VERSION,
      title: "Rides",
    });
    expect(buildCommitmentMetadata({ title: "Rides", description: "  " })).not.toHaveProperty(
      "description"
    );
  });

  it("reads back what it wrote", () => {
    const written = buildCommitmentMetadata({ title: "Rides", description: "To the market" });
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
        description: "Two hours on Saturday",
        unitLabel: "hours",
        targetUnits: 2,
      },
      clientCommitmentId: "draft-1",
      poolId: 7n,
      cycleId: 0n,
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
      description: "Two hours on Saturday",
    });
  });

  it("stays a pure function, so the same draft always hashes the same", () => {
    expect(payload()).toEqual(payload());
  });
});
