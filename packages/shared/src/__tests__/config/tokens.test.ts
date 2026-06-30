import { describe, expect, it } from "vitest";
import {
  buildSendableTokens,
  GOODS_TOKEN_META,
  getStablecoinSendableTokens,
} from "../../config/tokens";
import type { Address } from "../../types/domain";

const ARBITRUM = 42161;
const GOODS = "0x6Fc6bF735d2884dec59B0E9c8a00A9740C305c9e" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

describe("sendable token registry", () => {
  it("marks USDC/DAI/WETH supported on Arbitrum and GoodDollar unsupported", () => {
    const bySymbol = Object.fromEntries(
      getStablecoinSendableTokens(ARBITRUM).map((token) => [token.symbol, token])
    );

    expect(bySymbol.USDC?.supported).toBe(true);
    expect(bySymbol.DAI?.supported).toBe(true);
    expect(bySymbol.WETH?.supported).toBe(true);
    expect(bySymbol.USDC?.decimals).toBe(6);

    // G$ is Celo-only — not deployed on Arbitrum.
    expect(bySymbol["G$"]?.supported).toBe(false);
    expect(bySymbol["G$"]?.disabledReason).toBeTruthy();

    // GOODS is never part of the stablecoin-only list (resolved separately).
    expect(bySymbol.GOODS).toBeUndefined();
    // No stablecoin claims governance.
    expect(getStablecoinSendableTokens(ARBITRUM).every((t) => !t.confersGovernance)).toBe(true);
  });

  it("leads with GOODS (governance) when a resolved address is provided", () => {
    const tokens = buildSendableTokens(ARBITRUM, GOODS);

    expect(tokens[0]?.symbol).toBe("GOODS");
    expect(tokens[0]?.confersGovernance).toBe(true);
    expect(tokens[0]?.supported).toBe(true);
    expect(tokens[0]?.decimals).toBe(GOODS_TOKEN_META.decimals);
    expect(tokens[0]?.address.toLowerCase()).toBe(GOODS.toLowerCase());
  });

  it("omits GOODS when the resolved address is null or zero", () => {
    expect(buildSendableTokens(ARBITRUM, null).some((t) => t.symbol === "GOODS")).toBe(false);
    expect(buildSendableTokens(ARBITRUM, ZERO).some((t) => t.symbol === "GOODS")).toBe(false);
  });

  it("keeps supported tokens unique by address while preserving unsupported rows", () => {
    const tokens = buildSendableTokens(ARBITRUM, GOODS);

    const supportedAddresses = tokens
      .filter((token) => token.supported)
      .map((token) => token.address.toLowerCase());
    expect(new Set(supportedAddresses).size).toBe(supportedAddresses.length);

    // The unsupported GoodDollar row is still surfaced (so the UI can show it disabled).
    expect(tokens.some((token) => token.symbol === "G$" && !token.supported)).toBe(true);
  });
});
