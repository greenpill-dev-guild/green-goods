import { describe, expect, it, vi } from "vitest";
import { parseContractError } from "../../../utils/errors/contract-errors";
import {
  assertWalletCanFundTransaction,
  WalletCannotFundTransactionError,
  type WalletFundingReader,
} from "../wallet-funding";

const WALLET = "0x77b351d3d851158e246fbd483fd66a78e52c79c2";
const ENS = "0x4fAD8Db8e04005884D484eC730aDae10d7A2e491";
const CLAIM_DATA = "0x12199b7d";

function createReader(params: {
  balance: bigint;
  gas?: bigint;
  fees?: Awaited<ReturnType<WalletFundingReader["estimateFeesPerGas"]>>;
}) {
  return {
    getBalance: vi.fn().mockResolvedValue(params.balance),
    estimateGas: vi.fn().mockResolvedValue(params.gas ?? 0n),
    estimateFeesPerGas: vi.fn().mockResolvedValue(params.fees ?? { maxFeePerGas: 0n }),
  } satisfies WalletFundingReader;
}

describe("assertWalletCanFundTransaction", () => {
  // Measured on Arbitrum on 2026-09-22, when a wallet-paid claim opened Rabby with nothing to sign.
  it("rejects a wallet whose balance is below the value it must send", async () => {
    const reader = createReader({ balance: 289593851115021n });

    const check = assertWalletCanFundTransaction(reader, {
      account: WALLET,
      to: ENS,
      data: CLAIM_DATA,
      value: 293295051322012n,
    });

    await expect(check).rejects.toBeInstanceOf(WalletCannotFundTransactionError);
    await expect(check).rejects.toMatchObject({
      required: 293295051322012n,
      balance: 289593851115021n,
    });
  });

  it("accepts a sponsored claim when the wallet covers its gas", async () => {
    // 406,236 gas at 0.024252 gwei is 0.000009852 ETH; the wallet held 0.000014 ETH.
    const reader = createReader({
      balance: 14074350494372n,
      gas: 406236n,
      fees: { maxFeePerGas: 24252000n },
    });

    await expect(
      assertWalletCanFundTransaction(reader, { account: WALLET, to: ENS, data: CLAIM_DATA })
    ).resolves.toBeUndefined();
    expect(reader.estimateGas).toHaveBeenCalledWith({
      account: WALLET,
      to: ENS,
      data: CLAIM_DATA,
      value: 0n,
    });
  });

  it("rejects a wallet that cannot cover gas for a call that sends no value", async () => {
    const reader = createReader({
      balance: 1_000_000_000_000n,
      gas: 406236n,
      fees: { maxFeePerGas: 24252000n },
    });

    await expect(
      assertWalletCanFundTransaction(reader, { account: WALLET, to: ENS, data: CLAIM_DATA })
    ).rejects.toMatchObject({ required: 9852035472000n, balance: 1_000_000_000_000n });
  });

  it("counts value and gas together", async () => {
    const reader = createReader({ balance: 1500n, gas: 100n, fees: { maxFeePerGas: 10n } });

    await expect(
      assertWalletCanFundTransaction(reader, {
        account: WALLET,
        to: ENS,
        data: CLAIM_DATA,
        value: 1000n,
      })
    ).rejects.toMatchObject({ required: 2000n, balance: 1500n });
  });

  it("prices gas with the legacy gas price when the chain reports no fee cap", async () => {
    const reader = createReader({ balance: 999n, gas: 100n, fees: { gasPrice: 10n } });

    await expect(
      assertWalletCanFundTransaction(reader, { account: WALLET, to: ENS, data: CLAIM_DATA })
    ).rejects.toMatchObject({ required: 1000n });
  });

  it("lets a reverting call fail with its own error", async () => {
    const revert = new Error("execution reverted: NotProtocolMember()");
    const reader = createReader({ balance: 10n ** 18n });
    reader.estimateGas.mockRejectedValue(revert);

    await expect(
      assertWalletCanFundTransaction(reader, { account: WALLET, to: ENS, data: CLAIM_DATA })
    ).rejects.toBe(revert);
  });

  it("is read by the shared error parser as a wallet balance error", () => {
    const parsed = parseContractError(
      new WalletCannotFundTransactionError({ required: 2000n, balance: 1500n })
    );

    expect(parsed).toMatchObject({ name: "InsufficientFunds", isKnown: true });
  });
});
