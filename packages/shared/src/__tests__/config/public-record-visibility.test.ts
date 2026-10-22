// TEST-QUALITY: allow-small-test-file - This bounded policy has two identity and classification decisions.
import { describe, expect, it } from "vitest";
import {
  publicRehearsalCycles,
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
  });

  it("keeps uncertainty distinct from test activity and scopes work by chain and garden", () => {
    expect(
      publicWorkReviewStatus(
        { id: testId.toUpperCase(), gardenAddress: gardenAddress.toUpperCase() },
        42161
      )
    ).toBe("test");
    expect(publicWorkReviewStatus({ id: pendingId, gardenAddress }, 42161)).toBe("pending-review");
    expect(publicWorkReviewStatus({ id: testId, gardenAddress }, 11155111)).toBeUndefined();
    expect(
      publicWorkReviewStatus({ id: testId, gardenAddress: "0x" + "1".repeat(40) }, 42161)
    ).toBeUndefined();
    expect(
      publicWorkReviewStatus({ id: "0x" + "a".repeat(64), gardenAddress }, 42161)
    ).toBeUndefined();
  });
});
