import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  zeroAddress,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  assertVoucherAwardCalldata,
  verifyVoucherAwardLogs,
  voucherAwardOwnerCall,
  voucherAwardSafeEnvelope,
  voucherAwardSafeTypedData,
  VOUCHER_AWARD_SAFE_ABI,
} from "../modules/commitment-pooling/voucher-award-safe";
import type { VoucherAwardRecord } from "../public-contracts/voucher-awards";

const reserve = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const owner = "0x4444444444444444444444444444444444444444";
const award = {
  awardId: "old-work",
  reserve,
  token,
  recipient,
  amount: "3",
  reason: "Past contribution",
  reference: null,
} as const;
const record = (): VoucherAwardRecord => ({
  version: 1,
  award,
  safe: voucherAwardSafeEnvelope(award, 7n, 1),
  state: "awaiting_authorization",
  transactionHash: null,
  failure: null,
  createdBy: owner,
  createdAt: "2026-11-08T00:00:00Z",
  updatedAt: "2026-11-08T00:00:00Z",
  revision: 0,
});
const transfer = (amount = 3n) => ({
  address: token,
  topics: encodeEventTopics({
    abi: erc20Abi,
    eventName: "Transfer",
    args: { from: reserve, to: recipient },
  }) as Hex[],
  data: encodeAbiParameters([{ type: "uint256" }], [amount]),
});
const success = (r: VoucherAwardRecord, indexed = false) => ({
  address: reserve,
  topics: encodeEventTopics({
    abi: parseAbi([
      `event ExecutionSuccess(bytes32 ${indexed ? "indexed " : ""}txHash,uint256 payment)`,
    ]),
    eventName: "ExecutionSuccess",
    args: indexed ? { txHash: r.safe.safeTxHash } : {},
  }) as Hex[],
  data: indexed
    ? encodeAbiParameters([{ type: "uint256" }], [0n])
    : encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [r.safe.safeTxHash, 0n]),
});

describe("voucher award Safe boundary", () => {
  it("requires the owner's exact nonce-bound signature and rejects prevalidated replayable signatures", async () => {
    const r = record();
    const signer = privateKeyToAccount(generatePrivateKey());
    const signature = await signer.signTypedData(voucherAwardSafeTypedData(r.award, 7n));
    const call = await voucherAwardOwnerCall(r, signer.address, signature);
    expect(call.account).toBe(signer.address);
    expect(call.args[9]).toBe(signature);
    expect(call.args.slice(3, 9)).toEqual([0, 0n, 0n, 0n, zeroAddress, zeroAddress]);
    const encoded = encodeFunctionData({
      abi: VOUCHER_AWARD_SAFE_ABI,
      functionName: "execTransaction",
      args: call.args as never,
    });
    expect(() => assertVoucherAwardCalldata(r, encoded)).not.toThrow();
    expect(voucherAwardSafeEnvelope(award, 8n, 1).safeTxHash).not.toBe(r.safe.safeTxHash);
    await expect(
      voucherAwardOwnerCall({ ...r, safe: { ...r.safe, threshold: 2 } }, signer.address, signature)
    ).rejects.toThrow();
    await expect(
      voucherAwardOwnerCall({ ...r, award: { ...award, amount: "4" } }, signer.address, signature)
    ).rejects.toThrow();
    await expect(
      voucherAwardOwnerCall({ ...r, state: "submitted" }, signer.address, signature)
    ).rejects.toThrow();
    await expect(
      voucherAwardOwnerCall(
        { ...r, safe: voucherAwardSafeEnvelope(award, 8n, 1) },
        signer.address,
        signature
      )
    ).rejects.toThrow();
    await expect(
      voucherAwardOwnerCall(r, owner, `0x${owner.slice(2).padStart(64, "0")}${"0".repeat(64)}01`)
    ).rejects.toThrow();
  });
  it.each([
    false,
    true,
  ])("requires the exact Safe success and exact token transfer (indexed=%s)", (indexed) => {
    const r = record();
    expect(verifyVoucherAwardLogs(r, [success(r, indexed), transfer()])).toBe("confirmed");
    expect(() => verifyVoucherAwardLogs(r, [success(r, indexed)])).toThrow();
    expect(() => verifyVoucherAwardLogs(r, [success(r, indexed), transfer(2n)])).toThrow();
    expect(() =>
      verifyVoucherAwardLogs(r, [success(r, indexed), { ...transfer(), address: recipient }])
    ).toThrow();
    expect(() =>
      verifyVoucherAwardLogs(r, [
        success({ ...r, safe: { ...r.safe, safeTxHash: `0x${"ab".repeat(32)}` } }, indexed),
        transfer(),
      ])
    ).toThrow();
  });
  it("records an exact Safe failure only when no recipient transfer occurred", () => {
    const r = record();
    const failure = {
      ...success(r),
      topics: encodeEventTopics({
        abi: VOUCHER_AWARD_SAFE_ABI,
        eventName: "ExecutionFailure",
      }) as Hex[],
    };
    expect(verifyVoucherAwardLogs(r, [failure])).toBe("safe_execution_failed");
    expect(() => verifyVoucherAwardLogs(r, [failure, transfer()])).toThrow();
    expect(() => verifyVoucherAwardLogs(r, [success(r), success(r), transfer()])).toThrow(
      "Duplicate"
    );
  });
});
