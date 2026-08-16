import { describe, expect, it } from "vitest";

import {
  assertMatchingAccountProfile,
  getSettlementAccountProfile,
  isGardenerDeliveryEnabled,
} from "../modules/commitment-pooling/account-profiles";

describe("settlement smart-account profiles", () => {
  it("uses Kernel 0.2.4 on both testnets and Kernel 0.3.1 on both mainnets", () => {
    expect(getSettlementAccountProfile(421614)?.kernelVersion).toBe("0.2.4");
    expect(getSettlementAccountProfile(11142220)?.kernelVersion).toBe("0.2.4");
    expect(getSettlementAccountProfile(42161)?.kernelVersion).toBe("0.3.1");
    expect(getSettlementAccountProfile(42220)?.kernelVersion).toBe("0.3.1");
    expect(getSettlementAccountProfile(11155111)).toBeUndefined();
  });

  it("accepts exact matching profiles and rejects mixed profile components", () => {
    const source = getSettlementAccountProfile(421614)!;
    const destination = getSettlementAccountProfile(11142220)!;
    expect(assertMatchingAccountProfile(source, destination).profileId).toBe(
      "kernel-0.2.4-testnet"
    );
    expect(() => assertMatchingAccountProfile(source, getSettlementAccountProfile(42220)!)).toThrow(
      "account profile mismatch"
    );
  });

  it("never lets testnet evidence or nullable flags enable gardener delivery", () => {
    expect(
      isGardenerDeliveryEnabled({ chainId: 421614, indexed: true, mainnetEvidenceReady: true })
    ).toBe(false);
    expect(
      isGardenerDeliveryEnabled({ chainId: 42220, indexed: null, mainnetEvidenceReady: true })
    ).toBe(false);
    expect(
      isGardenerDeliveryEnabled({ chainId: 42220, indexed: true, mainnetEvidenceReady: false })
    ).toBe(false);
    expect(
      isGardenerDeliveryEnabled({ chainId: 42220, indexed: true, mainnetEvidenceReady: true })
    ).toBe(true);
  });
});
