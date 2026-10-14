import { describe, expect, it } from "vitest";
import { resolveDefaultChainId } from "../../config/default-chain";

describe("resolveDefaultChainId", () => {
  it.each([31337, 11155111, 42161, 42220])("keeps deployed chain %s", (chainId) => {
    expect(resolveDefaultChainId(chainId)).toBe(chainId);
    expect(resolveDefaultChainId(String(chainId))).toBe(chainId);
  });

  it.each([undefined, "", "not-a-chain", 1])("falls back to Arbitrum for %s", (chainId) => {
    expect(resolveDefaultChainId(chainId)).toBe(42161);
  });
});
