import { describe, expect, it } from "vitest";
import { getDepositLimitLabel } from "@/components/Vault/depositLimit";

describe("getDepositLimitLabel", () => {
  it("renders uint256 max deposit limits as Unlimited", () => {
    const maxUint256 = (1n << 256n) - 1n;

    expect(
      getDepositLimitLabel(maxUint256, {
        assetSymbol: "DAI",
        decimals: 18,
        unlimitedLabel: "Unlimited",
      })
    ).toBe("Unlimited");
  });

  it("formats bounded deposit limits with token denomination", () => {
    expect(
      getDepositLimitLabel(1_500_000_000_000_000_000n, {
        assetSymbol: "DAI",
        decimals: 18,
        unlimitedLabel: "Unlimited",
      })
    ).toBe("1.5 DAI");
  });
});
