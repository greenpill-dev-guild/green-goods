/**
 * Yearn V3 yield-source adapter tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../../types/domain";
import { yearnV3Adapter } from "../../../../utils/blockchain/yield-sources/yearn-v3-adapter";

const SOURCE = "0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0" as Address;
const mockFetch = vi.fn();

describe("utils/blockchain/yield-sources/yearn-v3-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("matches only the yearn-v3 kind", () => {
    expect(yearnV3Adapter.matches("yearn-v3")).toBe(true);
    expect(yearnV3Adapter.matches("aave-v3")).toBe(false);
    expect(yearnV3Adapter.matches("lido")).toBe(false);
    expect(yearnV3Adapter.matches("unknown")).toBe(false);
  });

  it("reads netAPR from yDaemon and returns a percentage", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ apr: { netAPR: 0.0143 } }) });

    const result = await yearnV3Adapter.readApy({ sourceAddress: SOURCE, chainId: 1 });

    expect(result.kind).toBe("yearn-v3");
    expect(result.apy).toBeCloseTo(1.43, 2);
    expect(result.apr).toBeCloseTo(1.43, 2);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://ydaemon.yearn.fi/1/vaults/${SOURCE}`,
      expect.objectContaining({ headers: { accept: "application/json" } })
    );
  });

  it("throws when yDaemon returns a non-ok status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(yearnV3Adapter.readApy({ sourceAddress: SOURCE, chainId: 1 })).rejects.toThrow();
  });

  it("throws when the response is missing apr.netAPR", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ apr: null }) });
    await expect(yearnV3Adapter.readApy({ sourceAddress: SOURCE, chainId: 1 })).rejects.toThrow();
  });
});
