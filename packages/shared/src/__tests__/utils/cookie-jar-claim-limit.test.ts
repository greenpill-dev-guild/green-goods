import { describe, expect, it } from "vitest";
import {
  claimsToEmptyJar,
  formatClaimCadence,
  getJarClaimLimitGuidance,
  isJarClaimLimitLow,
} from "../../utils/cookie-jar-claim-limit";

const ARBITRUM = 42161;
const DAI = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const UNKNOWN = "0x1111111111111111111111111111111111111111";

const jar = (assetAddress: string, maxWithdrawal: bigint) => ({
  assetAddress: assetAddress as `0x${string}`,
  decimals: 18,
  maxWithdrawal,
});

describe("cookie jar claim limit rule", () => {
  it("reads a DAI limit under 4 as low and 4 itself as fine", () => {
    expect(isJarClaimLimitLow(jar(DAI, 10n ** 16n), ARBITRUM)).toBe(true);
    expect(isJarClaimLimitLow(jar(DAI, 4n * 10n ** 18n - 1n), ARBITRUM)).toBe(true);
    expect(isJarClaimLimitLow(jar(DAI, 4n * 10n ** 18n), ARBITRUM)).toBe(false);
    expect(isJarClaimLimitLow(jar(DAI, 10n * 10n ** 18n), ARBITRUM)).toBe(false);
  });

  it("holds WETH to its own floor, so 0.01 WETH is fine", () => {
    expect(isJarClaimLimitLow(jar(WETH, 10n ** 16n), ARBITRUM)).toBe(false);
    expect(isJarClaimLimitLow(jar(WETH, 3n * 10n ** 15n), ARBITRUM)).toBe(true);
  });

  it("suggests 10 DAI and 0.01 WETH", () => {
    expect(getJarClaimLimitGuidance(jar(DAI, 0n), ARBITRUM)?.suggested).toBe(10n * 10n ** 18n);
    expect(getJarClaimLimitGuidance(jar(WETH, 0n), ARBITRUM)?.suggested).toBe(10n ** 16n);
  });

  it("has no opinion on an asset it does not know, or on a limit that failed to load", () => {
    expect(getJarClaimLimitGuidance(jar(UNKNOWN, 1n), ARBITRUM)).toBeNull();
    expect(isJarClaimLimitLow(jar(UNKNOWN, 1n), ARBITRUM)).toBe(false);
    expect(isJarClaimLimitLow(jar(DAI, 0n), ARBITRUM)).toBe(false);
  });

  it("words a cooldown as how often one gardener can claim", () => {
    const formatMessage = ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id}:${values.count}` : id;

    expect(formatClaimCadence(formatMessage, 86_400n)).toBe("app.cookieJar.cadence.days:1");
    expect(formatClaimCadence(formatMessage, 604_800n)).toBe("app.cookieJar.cadence.days:7");
    expect(formatClaimCadence(formatMessage, 43_200n)).toBe("app.cookieJar.cadence.hours:12");
    expect(formatClaimCadence(formatMessage, 5_400n)).toBe("app.cookieJar.cadence.minutes:90");
    expect(formatClaimCadence(formatMessage, 0n)).toBe("app.cookieJar.cadence.none");
  });

  it("counts the claims it takes to empty a jar, rounding up", () => {
    expect(claimsToEmptyJar(998n * 10n ** 16n, 10n ** 16n)).toBe(998n);
    expect(claimsToEmptyJar(25n * 10n ** 18n, 10n ** 16n)).toBe(2500n);
    expect(claimsToEmptyJar(5n, 2n)).toBe(3n);
    expect(claimsToEmptyJar(0n, 10n)).toBe(0n);
    expect(claimsToEmptyJar(10n, 0n)).toBe(0n);
  });
});
