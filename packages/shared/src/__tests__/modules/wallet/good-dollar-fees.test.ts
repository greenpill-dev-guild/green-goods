import { describe, expect, it, vi, beforeEach } from "vitest";
import { quoteGoodDollarTransfer } from "../../../modules/wallet/good-dollar-fees";
import { CELO_G_DOLLAR_TOKEN } from "../../../config/tokens";
import type { Address } from "../../../types/domain";
const readContract = vi.hoisted(() => vi.fn());
vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({ readContract }),
}));
const sender = "0x1111111111111111111111111111111111111111" as Address;
const recipient = "0x2222222222222222222222222222222222222222" as Address;

describe("GoodDollar transfer fee quotes", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    [true, 110n, 100n],
    [false, 100n, 90n],
  ])("quotes senderPays=%s from actual sender and recipient", async (senderPays, totalDebit, recipientAmount) => {
    readContract.mockResolvedValue([10n, senderPays]);
    expect(await quoteGoodDollarTransfer(100n, sender, recipient)).toEqual({
      amount: 100n,
      fee: 10n,
      senderPays,
      totalDebit,
      recipientAmount,
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CELO_G_DOLLAR_TOKEN.address,
        functionName: "getFees",
        args: [100n, sender, recipient],
      })
    );
  });
  it("supports a zero token fee", async () => {
    readContract.mockResolvedValue([0n, false]);
    expect(await quoteGoodDollarTransfer(100n, sender, recipient)).toMatchObject({
      fee: 0n,
      totalDebit: 100n,
      recipientAmount: 100n,
    });
  });
  it.each([
    null,
    [10n],
    [10n, "true"],
    ["10", true],
    [-1n, true],
    [101n, false],
  ])("rejects malformed or impossible fee %s", async (value) => {
    readContract.mockResolvedValue(value);
    await expect(quoteGoodDollarTransfer(100n, sender, recipient)).rejects.toThrow(/fee/i);
  });
  it("propagates a read failure and permits an explicit fresh retry", async () => {
    readContract
      .mockRejectedValueOnce(new Error("RPC unavailable"))
      .mockResolvedValueOnce([0n, true]);
    await expect(quoteGoodDollarTransfer(100n, sender, recipient)).rejects.toThrow();
    expect(await quoteGoodDollarTransfer(100n, sender, recipient)).toMatchObject({ fee: 0n });
  });
  it("rejects uint256 overflow", async () => {
    readContract.mockResolvedValue([1n, true]);
    await expect(quoteGoodDollarTransfer(2n ** 256n - 1n, sender, recipient)).rejects.toThrow(
      /fee/i
    );
  });
});
