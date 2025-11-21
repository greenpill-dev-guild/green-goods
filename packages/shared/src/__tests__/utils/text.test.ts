import { describe, expect, it } from "vitest";
import { formatAddress } from "../../../utils";

const SAMPLE_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

describe("formatAddress", () => {
  it("returns fallback text when address is missing", () => {
    expect(formatAddress(undefined)).toBe("no address provided");
    expect(formatAddress(null, { fallbackLabel: "unknown" })).toBe("unknown");
  });

  it("prefers ENS names passed via options", () => {
    expect(formatAddress(SAMPLE_ADDRESS, { ensName: "alice.eth" })).toBe("alice.eth");
  });

  it("respects existing ENS formatted addresses", () => {
    expect(formatAddress("alice.eth")).toBe("alice.eth");
  });

  it("uses default variant of 6/4 characters", () => {
    expect(formatAddress(SAMPLE_ADDRESS)).toBe("0x1234...5678");
  });

  it("supports the card variant with shorter slices", () => {
    expect(formatAddress(SAMPLE_ADDRESS, { variant: "card" })).toBe("0x12...678");
  });

  it("supports the long variant with extended slices", () => {
    expect(formatAddress(SAMPLE_ADDRESS, { variant: "long" })).toBe("0x123456...345678");
  });

  it("returns the address unmodified when shorter than truncation", () => {
    expect(formatAddress("0x1234")).toBe("0x1234");
  });
});
