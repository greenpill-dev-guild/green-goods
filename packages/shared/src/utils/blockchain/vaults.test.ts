import { describe, expect, it } from "vitest";
import { formatTokenAmount } from "./vaults";

describe("formatTokenAmount", () => {
  it("keeps tiny non-zero balances visible for 18-decimal amounts", () => {
    expect(formatTokenAmount(1n, 18, 4, "en-US")).toBe("0.000000000000000001");
  });

  it("keeps tiny non-zero balances visible for lower-decimal assets", () => {
    expect(formatTokenAmount(12n, 8, 4, "en-US")).toBe("0.00000012");
  });
});
