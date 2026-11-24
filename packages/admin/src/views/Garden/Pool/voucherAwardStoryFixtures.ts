import type { VoucherAwardRecord } from "@green-goods/shared/public-contracts/voucher-awards";
import { encodeFunctionData, erc20Abi, zeroAddress } from "viem";

/** Synthetic accounts and receipt for rendering only; never a live award. */
export const awardStoryRecord: VoucherAwardRecord = {
  version: 1,
  award: {
    awardId: "fictional-past-design",
    reserve: "0x1111111111111111111111111111111111111111",
    token: "0x2222222222222222222222222222222222222222",
    recipient: "0x3333333333333333333333333333333333333333",
    amount: "2000000",
    reason: "Design work completed before vouchers",
    reference: "Fictional contribution 7",
  },
  safe: {
    safe: "0x1111111111111111111111111111111111111111",
    chainId: 100,
    to: "0x2222222222222222222222222222222222222222",
    value: "0",
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: ["0x3333333333333333333333333333333333333333", 2000000n],
    }),
    operation: 0,
    safeTxGas: "0",
    baseGas: "0",
    gasPrice: "0",
    gasToken: zeroAddress,
    refundReceiver: zeroAddress,
    nonce: "3",
    safeTxHash: `0x${"a".repeat(64)}`,
    threshold: 1,
  },
  state: "awaiting_authorization",
  transactionHash: null,
  failure: null,
  createdBy: "0x4444444444444444444444444444444444444444",
  createdAt: "2026-11-07T00:00:00Z",
  updatedAt: "2026-11-07T00:00:00Z",
  revision: 1,
};
