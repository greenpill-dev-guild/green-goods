// TEST-QUALITY: allow-small-test-file - This bounded policy has two identity and classification decisions.
import { describe, expect, it } from "vitest";
import type { Address } from "../../types/domain";
import {
  isPublicPassportPublished,
  publicRehearsalCommitments,
  publicRehearsalCycles,
  publicReviewedWorkExclusionIds,
  publicWorkReviewStatus,
} from "../../config/public-record-visibility";

const gardenAddress = "0xf401f34378384713222d1d21f63359cc4e8a858a";
const testId = "0x15916dfa15db19351c79a2af1fd4f484cd5792b6f90ea701727b43fd67dac01c";
const pendingId = "0x5db91be5ad17144250cc04a9339318a017cb7dd0f895c8b75efdcd3d9a959d97";

describe("reviewed public record policy", () => {
  it("classifies the reviewed cycle only on its chain and pool", () => {
    expect(publicRehearsalCycles(42161, 1n)).toEqual([{ chainId: 42161, poolId: 1n, cycleId: 1n }]);
    expect(publicRehearsalCycles(42161, 2n)).toEqual([]);
    expect(publicRehearsalCycles(11155111, 1n)).toEqual([]);
    // A single reviewed promise is scoped the same way, and never widens to its whole pool.
    expect(publicRehearsalCommitments(42161, 2n).map((entry) => entry.commitmentId)).toEqual([85n]);
    expect(publicRehearsalCommitments(42161, 1n)).toEqual([]);
    expect(publicRehearsalCommitments(11155111, 2n)).toEqual([]);
  });

  it("keeps uncertainty distinct from test activity and scopes work by chain and garden", () => {
    expect(
      publicWorkReviewStatus(
        { id: testId.toUpperCase(), gardenAddress: gardenAddress.toUpperCase() as Address },
        42161
      )
    ).toBe("test");
    expect(publicWorkReviewStatus({ id: pendingId, gardenAddress }, 42161)).toBe("pending-review");
    expect(publicWorkReviewStatus({ id: testId, gardenAddress }, 11155111)).toBeUndefined();
    expect(
      publicWorkReviewStatus({ id: testId, gardenAddress: `0x${"1".repeat(40)}` }, 42161)
    ).toBeUndefined();
    expect(
      publicWorkReviewStatus({ id: "0x" + "a".repeat(64), gardenAddress }, 42161)
    ).toBeUndefined();
  });

  it("publishes a passport only for the one garden whose owner agreed", () => {
    const published = "0xF7b892886998DAe960D64a9db488336684F137A0" as Address;
    expect(isPublicPassportPublished(42161, published)).toBe(true);
    // Consent is per garden and per chain: an open pool elsewhere publishes nothing.
    expect(isPublicPassportPublished(42161, gardenAddress as Address)).toBe(false);
    expect(isPublicPassportPublished(11155111, published)).toBe(false);
  });

  it("hides a reviewed record only in the garden it was reviewed for", () => {
    const qaFixture = "0x6fce9a2a5647cbee87300d1a5874e2d196afda0433cc8f6926f192390be16b58";
    const familyGarden = "0xF7b892886998DAe960D64a9db488336684F137A0" as Address;
    expect(publicWorkReviewStatus({ id: qaFixture, gardenAddress: familyGarden }, 42161)).toBe(
      "test"
    );
    expect(publicWorkReviewStatus({ id: qaFixture, gardenAddress }, 42161)).toBeUndefined();
    expect(
      publicWorkReviewStatus({ id: testId, gardenAddress: familyGarden }, 42161)
    ).toBeUndefined();
    expect(publicReviewedWorkExclusionIds(42161)).toEqual(
      expect.arrayContaining([testId, pendingId, qaFixture])
    );
    expect(publicReviewedWorkExclusionIds(42161)).toHaveLength(20);
    expect(publicReviewedWorkExclusionIds(11155111)).toEqual([]);
  });
});
