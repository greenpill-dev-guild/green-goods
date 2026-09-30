import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Hash } from "viem";

const mocks = vi.hoisted(() => ({ client: vi.fn(), receipt: vi.fn(), block: vi.fn() }));
vi.mock("../config/pimlico", () => ({ createPublicClientForChain: mocks.client }));

import { valueFundingReceiptsUsdCents } from "../modules/commitment-pooling/funding-valuation";

const TOKEN = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const COIN = `celo:${TOKEN}`;
const TX = ("0x" + "a".repeat(64)) as Hash;
const RECEIVED_AT = 1788220800;
const receipt = { amount: 1000000n * 10n ** 18n, token: TOKEN, transactionHash: TX };

function price(timestamp = RECEIVED_AT, value = 0.0001, patch = {}) {
  return {
    coins: {
      [COIN]: { price: value, timestamp, confidence: 0.99, decimals: 18, symbol: "G$", ...patch },
    },
  };
}
function reads() {
  return {
    receivedAt: vi.fn().mockResolvedValue(RECEIVED_AT),
    priceAt: vi.fn().mockResolvedValue(price()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockReturnValue({ getTransactionReceipt: mocks.receipt, getBlock: mocks.block });
  mocks.receipt.mockResolvedValue({ status: "success", blockHash: TX });
  mocks.block.mockResolvedValue({ timestamp: BigInt(RECEIVED_AT) });
});
afterEach(() => vi.unstubAllGlobals());

describe("receipt-time funding valuation", () => {
  it("values each receipt at its own historical rate and reuses shared receipt reads", async () => {
    const source = reads();
    const secondTx = ("0x" + "b".repeat(64)) as Hash;
    source.receivedAt.mockImplementation(async (hash) =>
      hash === TX ? RECEIVED_AT : RECEIVED_AT + 86400
    );
    source.priceAt.mockImplementation(async (timestamp) =>
      price(timestamp, timestamp === RECEIVED_AT ? 0.0001 : 0.0002)
    );
    const total = await valueFundingReceiptsUsdCents(
      [receipt, receipt, { ...receipt, transactionHash: secondTx }],
      source
    );
    expect(total).toBe(40000n);
    expect(source.receivedAt).toHaveBeenCalledTimes(2);
    expect(source.priceAt.mock.calls).toEqual([
      [RECEIVED_AT, COIN],
      [RECEIVED_AT + 86400, COIN],
    ]);
  });

  it("rounds once after combining receipts smaller than a cent", async () => {
    const small = { ...receipt, amount: 40n * 10n ** 18n };
    expect(await valueFundingReceiptsUsdCents([small, small], reads())).toBe(1n);
  });

  it.each([
    ["missing", {}],
    ["stale", price(RECEIVED_AT - 3601)],
    ["low confidence", price(RECEIVED_AT, 0.0001, { confidence: 0.5 })],
    ["invalid confidence", price(RECEIVED_AT, 0.0001, { confidence: NaN })],
    ["wrong decimals", price(RECEIVED_AT, 0.0001, { decimals: 2 })],
    ["wrong asset", price(RECEIVED_AT, 0.0001, { symbol: "USDC" })],
    ["zero", price(RECEIVED_AT, 0)],
    ["invalid", price(RECEIVED_AT, NaN)],
  ])("rejects a %s quote instead of using today's rate", async (_name, quote) => {
    const source = reads();
    source.priceAt.mockResolvedValue(quote);
    await expect(valueFundingReceiptsUsdCents([receipt], source)).rejects.toThrow(/Historical/);
  });

  it("rejects unsupported tokens and missing execution evidence", async () => {
    await expect(
      valueFundingReceiptsUsdCents([{ ...receipt, token: "0xwrong" }], reads())
    ).rejects.toThrow(/unsupported/);
    await expect(
      valueFundingReceiptsUsdCents([{ ...receipt, transactionHash: "0xmissing" as Hash }], reads())
    ).rejects.toThrow(/execution/);
  });

  it("reads the Celo execution block and requests its historical quote", async () => {
    const fetchPrice = vi.fn().mockResolvedValue({ ok: true, json: async () => price() });
    vi.stubGlobal("fetch", fetchPrice);
    expect(await valueFundingReceiptsUsdCents([receipt])).toBe(10000n);
    expect(mocks.client).toHaveBeenCalledWith(42220);
    expect(mocks.receipt).toHaveBeenCalledWith({ hash: TX });
    expect(fetchPrice).toHaveBeenCalledWith(
      `https://coins.llama.fi/prices/historical/${RECEIVED_AT}/${COIN}`,
      { signal: expect.any(AbortSignal) }
    );
  });

  it("rejects an unsuccessful receipt or price-service response", async () => {
    mocks.receipt.mockResolvedValue({ status: "reverted", blockHash: TX });
    await expect(valueFundingReceiptsUsdCents([receipt])).rejects.toThrow(/did not succeed/);
    mocks.receipt.mockResolvedValue({ status: "success", blockHash: TX });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(valueFundingReceiptsUsdCents([receipt])).rejects.toThrow(/503/);
  });

  it("needs no price or chain reads for an empty history", async () => {
    const source = reads();
    expect(await valueFundingReceiptsUsdCents([], source)).toBe(0n);
    expect(source.receivedAt).not.toHaveBeenCalled();
    expect(source.priceAt).not.toHaveBeenCalled();
  });
});
