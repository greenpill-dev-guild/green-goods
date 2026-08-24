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

describe("buildPoolCharter", () => {
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
