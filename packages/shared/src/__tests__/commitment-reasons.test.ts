/**
 * Reasons are CIDs.
 *
 * `cancelCommitment`, `raiseDispute` and `resolveDispute` take a `reasonCID`,
 * and the timeline reads the document behind it. Sending the typed text in that
 * slot stores a sentence where a content address belongs, and nothing can ever
 * resolve it. The helper under test is the one place the document is shaped,
 * so every reason pinned by any surface has the same version and the same key.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadJSONToIPFS: vi.fn(),
}));

vi.mock("../modules/data/ipfs/upload", () => ({ uploadJSONToIPFS: mocks.uploadJSONToIPFS }));

const {
  buildCommitmentReason,
  COMMITMENT_REASON_VERSION,
  CommitmentReasonPinError,
  isCommitmentReasonPinError,
  parseCommitmentReason,
  pinCommitmentReason,
} = await import("../modules/commitment-pooling/reasons");

const GARDEN = "0x2222222222222222222222222222222222222222" as const;

describe("buildCommitmentReason", () => {
  it("shapes a versioned document from the member's words", () => {
    expect(buildCommitmentReason("  Plans changed,\n\nso I cannot.  ")).toEqual({
      version: COMMITMENT_REASON_VERSION,
      reason: "Plans changed, so I cannot.",
    });
  });

  it("refuses an empty reason rather than pinning a blank document", () => {
    expect(() => buildCommitmentReason("   ")).toThrow();
  });

  it("reads its own documents back and rejects anything else", () => {
    expect(parseCommitmentReason({ version: 1, reason: "Kept, but late" })).toEqual({
      version: 1,
      reason: "Kept, but late",
    });
    expect(parseCommitmentReason({ version: 1 })).toBeNull();
    expect(parseCommitmentReason("Kept, but late")).toBeNull();
    expect(parseCommitmentReason(null)).toBeNull();
  });
});

describe("pinCommitmentReason", () => {
  beforeEach(() => {
    mocks.uploadJSONToIPFS.mockReset();
  });

  it("pins the versioned document and returns its CID", async () => {
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "bafy-reason" });

    const cid = await pinCommitmentReason({
      reason: "Plans changed",
      gardenAddress: GARDEN,
      source: "withdraw",
    });

    expect(cid).toBe("bafy-reason");
    expect(mocks.uploadJSONToIPFS).toHaveBeenCalledWith(
      { version: COMMITMENT_REASON_VERSION, reason: "Plans changed" },
      expect.objectContaining({ gardenAddress: GARDEN, metadataType: "commitment-reason" })
    );
  });

  it("surfaces a pin failure as its own error so a surface can offer a retry", async () => {
    mocks.uploadJSONToIPFS.mockRejectedValue(new Error("gateway down"));

    const failure = await pinCommitmentReason({
      reason: "Plans changed",
      source: "withdraw",
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CommitmentReasonPinError);
    expect(isCommitmentReasonPinError(failure)).toBe(true);
    expect(isCommitmentReasonPinError(new Error("gateway down"))).toBe(false);
  });

  it("never pins an empty reason", async () => {
    await expect(pinCommitmentReason({ reason: " ", source: "withdraw" })).rejects.toThrow();
    expect(mocks.uploadJSONToIPFS).not.toHaveBeenCalled();
  });
});
