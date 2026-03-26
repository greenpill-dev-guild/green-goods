import { describe, expect, it } from "vitest";
import { rayToApy, formatApy } from "./aave";

describe("rayToApy", () => {
  it("returns 0 for zero liquidity rate", () => {
    expect(rayToApy(0n)).toBe(0);
  });

  it("returns a finite percentage for a representative AAVE rate", () => {
    // ~2% APR in ray: 2e25 (0.02 * 1e27)
    const twoPercentRay = 20000000000000000000000000n; // 2e25
    const apy = rayToApy(twoPercentRay);
    expect(Number.isFinite(apy)).toBe(true);
    // APY should be slightly above APR due to compounding
    expect(apy).toBeGreaterThan(2.0);
    expect(apy).toBeLessThan(2.1); // compounding bump is tiny for 2%
  });

  it("returns a finite percentage for a high rate (~10%)", () => {
    // ~10% APR in ray: 1e26 (0.1 * 1e27)
    const tenPercentRay = 100000000000000000000000000n; // 1e26
    const apy = rayToApy(tenPercentRay);
    expect(Number.isFinite(apy)).toBe(true);
    expect(apy).toBeGreaterThan(10.0);
    expect(apy).toBeLessThan(10.6); // compounding bump for 10% is ~0.52%
  });

  it("never returns NaN or Infinity", () => {
    // Very large rate that could overflow with the old formula
    const largeRate = 1000000000000000000000000000n; // 1e27 = 100% APR
    const apy = rayToApy(largeRate);
    expect(Number.isFinite(apy)).toBe(true);
    expect(apy).toBeGreaterThan(0);
  });
});

describe("formatApy", () => {
  it("formats to 2 decimal places with % suffix", () => {
    expect(formatApy(2.1234)).toBe("2.12%");
    expect(formatApy(0)).toBe("0.00%");
    expect(formatApy(10.5)).toBe("10.50%");
  });
});
