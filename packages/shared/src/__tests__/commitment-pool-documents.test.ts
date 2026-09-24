/**
 * The pool's charter and a cycle's name are CIDs.
 *
 * `setPoolCharter(poolId, charterCID)` and `seedCycle(…, metadataCID)` store
 * only a content address; the pool card reads the charter sentence and the
 * cycle rail reads the name from the document behind it. The two helpers under
 * test are the one place each document is shaped and pinned, so a charter
 * written in the console and one written anywhere else read back the same way,
 * and a pin failure is reported as exactly that before any call is sent.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitmentDocumentStore } from "../modules/commitment-pooling/document-store";
import {
  buildPoolCharter,
  isPoolDocumentPinError,
  parsePoolCharter,
  pinPoolCharter,
  POOL_CHARTER_VERSION,
  PoolDocumentPinError,
} from "../modules/commitment-pooling/pool-charter";
import {
  buildCycleMetadata,
  CYCLE_METADATA_VERSION,
  parseCycleMetadata,
  pinCycleMetadata,
} from "../modules/commitment-pooling/cycle-metadata";

const GARDEN = "0x2222222222222222222222222222222222222222" as const;
const pinJson = vi.fn();
const documents: CommitmentDocumentStore = {
  pinJson,
  readJson: vi.fn(),
};
const text = (length: number) => "x".repeat(length);

describe("buildPoolCharter", () => {
  // The write limit and the read tolerance side by side: a charter pinned
  // before the limit, longer than a steward can write today, still reads whole.
  it.each([
    {
      label: "writes and reads 420 characters",
      purpose: text(420),
      written: text(420),
      read: text(420),
    },
    {
      label: "refuses 421 but still reads them",
      purpose: text(421),
      written: "refused",
      read: text(421),
    },
    {
      label: "reads a stored 1,500 in full",
      purpose: text(1500),
      written: "refused",
      read: text(1500),
    },
    {
      label: "reads 2,001 cut to 2,000",
      purpose: text(2001),
      written: "refused",
      read: text(2000),
    },
    {
      label: "collapses whitespace before counting",
      purpose: `  ${text(200)}\n\n  ${text(219)}  `,
      written: `${text(200)} ${text(219)}`,
      read: `${text(200)} ${text(219)}`,
    },
  ])("$label", ({ purpose, written, read }) => {
    const write = () => buildPoolCharter({ purpose }).purpose;
    if (written === "refused") expect(write).toThrow("at most 420 characters");
    else expect(write()).toBe(written);
    expect(parsePoolCharter({ version: POOL_CHARTER_VERSION, purpose })?.purpose).toBe(read);
  });

  it("shapes a versioned document from the steward's sentence", () => {
    expect(
      buildPoolCharter({
        purpose: "  Neighbours in Rocinha offer help\n\nand ask for it.  ",
      })
    ).toEqual({
      version: POOL_CHARTER_VERSION,
      purpose: "Neighbours in Rocinha offer help and ask for it.",
    });
  });

  it("refuses an empty purpose rather than pinning a blank charter", () => {
    expect(() => buildPoolCharter({ purpose: "   " })).toThrow();
  });

  it("reads its own documents back and rejects anything else", () => {
    expect(parsePoolCharter({ version: 1, purpose: "Rides, tools, workshops" })).toEqual({
      version: 1,
      purpose: "Rides, tools, workshops",
    });
    expect(parsePoolCharter({ version: 1 })).toBeNull();
    expect(parsePoolCharter("Rides, tools, workshops")).toBeNull();
    expect(parsePoolCharter(null)).toBeNull();
  });
});

describe("pinPoolCharter", () => {
  beforeEach(() => {
    pinJson.mockReset();
  });

  it("pins the versioned document and returns its CID", async () => {
    pinJson.mockResolvedValue("bafy-charter");

    const cid = await pinPoolCharter(
      {
        purpose: "Neighbourly help in Rocinha",
        gardenAddress: GARDEN,
      },
      documents
    );

    expect(cid).toBe("bafy-charter");
    expect(pinJson).toHaveBeenCalledWith(
      { version: POOL_CHARTER_VERSION, purpose: "Neighbourly help in Rocinha" },
      expect.objectContaining({ gardenAddress: GARDEN, metadataType: "commitment-pool-charter" })
    );
  });

  it("surfaces a pin failure as its own error so the step stays open with a retry", async () => {
    pinJson.mockRejectedValue(new Error("gateway down"));

    const failure = await pinPoolCharter({ purpose: "Neighbourly help" }, documents).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(PoolDocumentPinError);
    expect(isPoolDocumentPinError(failure)).toBe(true);
    expect((failure as InstanceType<typeof PoolDocumentPinError>).document).toBe("charter");
  });
});

describe("cycle metadata write side", () => {
  beforeEach(() => {
    pinJson.mockReset();
  });

  it("shapes the document the cycle rail already reads", () => {
    const document = buildCycleMetadata({ name: "  Season of\nFirst Rains  " });
    expect(document).toEqual({ version: CYCLE_METADATA_VERSION, name: "Season of First Rains" });
    expect(parseCycleMetadata(document)).toEqual(document);
  });

  it("refuses an empty name", () => {
    expect(() => buildCycleMetadata({ name: "" })).toThrow();
  });

  it.each([
    { label: "writes a 120-character name", name: text(120), written: text(120) },
    { label: "refuses a 121-character name", name: text(121), written: "refused" },
  ])("$label", ({ name, written }) => {
    const write = () => buildCycleMetadata({ name }).name;
    if (written === "refused") expect(write).toThrow("at most 120 characters");
    else expect(write()).toBe(written);
  });

  it("pins the cycle name and returns its CID", async () => {
    pinJson.mockResolvedValue("bafy-season");

    const cid = await pinCycleMetadata(
      { name: "Season of First Rains", gardenAddress: GARDEN },
      documents
    );

    expect(cid).toBe("bafy-season");
    expect(pinJson).toHaveBeenCalledWith(
      { version: CYCLE_METADATA_VERSION, name: "Season of First Rains" },
      expect.objectContaining({ gardenAddress: GARDEN, metadataType: "commitment-cycle" })
    );
  });

  it("reports a failed cycle-name pin the same way as a failed charter pin", async () => {
    pinJson.mockRejectedValue(new Error("gateway down"));

    const failure = await pinCycleMetadata({ name: "Seedling swap" }, documents).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(PoolDocumentPinError);
    expect((failure as InstanceType<typeof PoolDocumentPinError>).document).toBe("cycle");
  });
});
