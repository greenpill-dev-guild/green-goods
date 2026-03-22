import { describe, expect, it } from "vitest";
import { checkMessageContent } from "../services/content-filter";

describe("checkMessageContent", () => {
  it("passes clean messages", () => {
    const result = checkMessageContent("Your work has been approved! Great job planting trees.");
    expect(result.clean).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("catches 'carbon credits'", () => {
    const result = checkMessageContent("You earned carbon credits for this work.");
    expect(result.clean).toBe(false);
    expect(result.violations).toContain("carbon credits");
  });

  it("catches 'blockchain'", () => {
    const result = checkMessageContent("Your work is recorded on the blockchain.");
    expect(result.clean).toBe(false);
    expect(result.violations).toContain("blockchain");
  });

  it("catches 'web3'", () => {
    const result = checkMessageContent("Welcome to web3 gardening!");
    expect(result.clean).toBe(false);
    expect(result.violations).toContain("web3");
  });

  it("catches 'gas fee'", () => {
    const result = checkMessageContent("A gas fee was charged for this transaction.");
    expect(result.clean).toBe(false);
    expect(result.violations).toContain("gas fee");
  });

  it("catches 'seed phrase'", () => {
    const result = checkMessageContent("Please save your seed phrase.");
    expect(result.clean).toBe(false);
    expect(result.violations).toContain("seed phrase");
  });

  it("catches 'decentralized'", () => {
    const result = checkMessageContent("This is a decentralized platform.");
    expect(result.clean).toBe(false);
    expect(result.violations).toContain("decentralized");
  });

  it("is case insensitive", () => {
    const result = checkMessageContent("Your CARBON CREDITS are ready.");
    expect(result.clean).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("does not false-positive on partial matches", () => {
    // "chain" alone should not trigger (only "chain switch" or "blockchain")
    const result = checkMessageContent("Your supply chain of seedlings is ready.");
    expect(result.clean).toBe(true);
  });

  it("returns multiple violations", () => {
    const result = checkMessageContent("Your blockchain carbon credits are decentralized.");
    expect(result.clean).toBe(false);
    expect(result.violations.length).toBe(3);
  });
});
