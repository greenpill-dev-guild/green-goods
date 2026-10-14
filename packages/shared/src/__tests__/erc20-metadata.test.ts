import { describe, expect, it } from "vitest";
import { erc20MetadataFromResults, erc20MetadataMap } from "../hooks/blockchain/useErc20Metadata";

const FIRST = "0x1111111111111111111111111111111111111111";
const SECOND = "0x2222222222222222222222222222222222222222";

describe("ERC-20 reward units", () => {
  it.each([
    null,
    undefined,
    "6",
    -1,
    1.5,
    Number.NaN,
  ])("holds a reward when decimals are %s", (decimals) => {
    expect(erc20MetadataFromResults(decimals, "USDC")).toEqual({ status: "unreadable" });
  });

  it("uses known decimals even when a token does not answer its symbol", () => {
    expect(erc20MetadataFromResults(6, " ")).toEqual({
      status: "ready",
      metadata: { decimals: 6, symbol: null },
    });
  });

  it("pairs each parked token with its own decimals and holds an unreadable row", () => {
    const reads = [{ result: 6 }, { result: "USDC" }, { result: undefined }, { result: "OTHER" }];
    expect(erc20MetadataMap([FIRST, SECOND], reads, false)).toEqual(
      new Map([
        [FIRST, { status: "ready", metadata: { decimals: 6, symbol: "USDC" } }],
        [SECOND, { status: "unreadable" }],
      ])
    );
    expect(erc20MetadataMap([FIRST, SECOND], reads, true).get(FIRST)).toEqual({
      status: "loading",
    });
  });
});
