import { describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  type Hex,
  zeroAddress,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { VOUCHER_AWARD_ISSUERS } from "@green-goods/shared/modules/commitment-pooling/voucher-award-config";
import {
  VOUCHER_AWARD_SAFE_ABI,
  voucherAwardOwnerCall,
  voucherAwardSafeEnvelope,
  voucherAwardSafeTypedData,
} from "@green-goods/shared/modules/commitment-pooling/voucher-award-safe";
import type { VoucherAwardRecord } from "@green-goods/shared/public-contracts";
import { createVoucherAwardChain } from "../services/voucher-awards-chain";

const reserve = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const implementation = "0x5555555555555555555555555555555555555555";
const hash = `0x${"ab".repeat(32)}` as const;
function fixture() {
  const owner = privateKeyToAccount(generatePrivateKey());
  const award = {
    awardId: "historic-21",
    reserve,
    token,
    recipient,
    amount: "3",
    reason: "Past contribution",
    reference: null,
  } as const;
  const safe = voucherAwardSafeEnvelope(award, 7n, 1);
  const record: VoucherAwardRecord = {
    version: 1,
    award,
    safe,
    state: "awaiting_authorization",
    transactionHash: null,
    failure: null,
    createdBy: owner.address as VoucherAwardRecord["createdBy"],
    createdAt: "2026-11-08T00:00:00Z",
    updatedAt: "2026-11-08T00:00:00Z",
    revision: 0,
  };
  const client = {
    readContract: vi.fn(
      async ({
        functionName,
        args,
      }: {
        functionName: string;
        args?: unknown[];
      }): Promise<unknown> => {
        switch (functionName) {
          case "owner":
            return reserve;
          case "balanceOf":
            return 100n;
          case "nonce":
            return 7n;
          case "getThreshold":
            return 1n;
          case "getTransactionHash":
            return safe.safeTxHash;
          case "isOwner":
            return String(args?.[0]).toLowerCase() === owner.address.toLowerCase();
          default:
            throw new Error("Unexpected RPC");
        }
      }
    ),
    getCode: vi.fn(async () => "0x1234" as Hex),
    getStorageAt: vi.fn(
      async ({ address }: { address: string }) =>
        `0x${(address === token ? implementation : zeroAddress).slice(2).padStart(64, "0")}` as Hex
    ),
    getTransactionReceipt: vi.fn(
      async (): Promise<{ status: "success" | "reverted"; logs: ReturnType<typeof logs> }> => ({
        status: "success",
        logs: logs(record),
      })
    ),
    getTransaction: vi.fn(async (): Promise<{ to: string; value: bigint; input: Hex }> => {
      const signature = await owner.signTypedData(voucherAwardSafeTypedData(award, 7n));
      const call = await voucherAwardOwnerCall(record, owner.address, signature);
      return {
        to: reserve,
        value: 0n,
        input: encodeFunctionData({
          abi: VOUCHER_AWARD_SAFE_ABI,
          functionName: "execTransaction",
          args: call.args as never,
        }),
      };
    }),
  };
  const asset = {
    ...VOUCHER_AWARD_ISSUERS[0],
    token,
    issuer: reserve,
    guardReceiver: null,
    runtimeCodeHash: keccak256("0x1234"),
    implementation: { address: implementation, runtimeCodeHash: keccak256("0x1234") },
  };
  const chain = createVoucherAwardChain({
    rpcUrl: "https://unused.invalid",
    issuers: [asset],
    client: client as unknown as NonNullable<
      Parameters<typeof createVoucherAwardChain>[0]["client"]
    >,
  });
  return { owner, record, chain, client };
}
function logs(r: VoucherAwardRecord) {
  return [
    {
      address: r.safe.safe,
      topics: encodeEventTopics({ abi: VOUCHER_AWARD_SAFE_ABI, eventName: "ExecutionSuccess" }),
      data: encodeAbiParameters(
        [{ type: "bytes32" }, { type: "uint256" }],
        [r.safe.safeTxHash, 0n]
      ),
    },
    {
      address: token,
      topics: encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
        args: { from: reserve, to: recipient },
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [3n]),
    },
  ];
}

describe("award chain verification", () => {
  it("pins the configured issuer/token and compares the Safe's exact onchain hash", async () => {
    const f = fixture();
    expect(await f.chain.prepare(f.record.award)).toEqual(f.record.safe);
    await expect(f.chain.prepare({ ...f.record.award, token: recipient })).rejects.toMatchObject({
      code: "issuer_unavailable",
    });
    f.client.getCode.mockResolvedValue("0x4321");
    await expect(f.chain.prepare(f.record.award)).rejects.toMatchObject({
      code: "issuer_configuration_changed",
    });
  });
  it("requires current ownership and refuses an unrecognized guard", async () => {
    const f = fixture();
    expect(await f.chain.canPrepare(reserve, f.owner.address)).toBe(true);
    expect(await f.chain.canPrepare(reserve, recipient)).toBe(false);
    f.client.getStorageAt.mockResolvedValue(`0x${recipient.slice(2).padStart(64, "0")}`);
    expect(await f.chain.canPrepare(reserve, f.owner.address)).toBe(false);
  });
  it("accepts an inner Safe receipt and refuses unrelated successful or reverted outer transactions", async () => {
    const f = fixture();
    expect(await f.chain.reconcile(f.record, hash)).toEqual({
      status: "confirmed",
      transactionHash: hash,
    });
    expect(f.client.getTransaction).not.toHaveBeenCalled();
    f.client.getTransactionReceipt.mockResolvedValue({ status: "success", logs: [] });
    await expect(f.chain.reconcile(f.record, hash)).rejects.toMatchObject({
      code: "transaction_unverified",
    });
    f.client.getTransactionReceipt.mockResolvedValue({ status: "reverted", logs: [] });
    f.client.getTransaction.mockResolvedValue({ to: recipient, value: 0n, input: "0x" });
    await expect(f.chain.reconcile(f.record, hash)).rejects.toMatchObject({
      code: "transaction_unverified",
    });
  });
  it("refuses every kind of receipt once the token's code changed after the award was prepared", async () => {
    const f = fixture();
    expect(await f.chain.prepare(f.record.award)).toEqual(f.record.safe);
    f.client.getCode.mockResolvedValue("0x4321");
    await expect(f.chain.reconcile(f.record, hash)).rejects.toMatchObject({
      code: "issuer_configuration_changed",
    });
    // Neither the successful receipt nor a pending transaction is even consulted.
    expect(f.client.getTransactionReceipt).not.toHaveBeenCalled();
    expect(f.client.getTransaction).not.toHaveBeenCalled();
  });
  it("proves the reviewed nonce-bound signatures before recording a reverted or pending attempt", async () => {
    const f = fixture();
    f.client.getTransactionReceipt.mockResolvedValue({ status: "reverted", logs: [] });
    expect(await f.chain.reconcile(f.record, hash)).toEqual({
      status: "transaction_reverted",
      transactionHash: hash,
    });
    f.client.getTransactionReceipt.mockRejectedValue(
      Object.assign(new Error("not found"), { name: "TransactionReceiptNotFoundError" })
    );
    expect((await f.chain.reconcile(f.record, hash)).status).toBe("submitted");
    const valid = await f.client.getTransaction();
    const wrong = await privateKeyToAccount(generatePrivateKey()).signTypedData(
      voucherAwardSafeTypedData(f.record.award, 7n)
    );
    f.client.getTransaction.mockResolvedValue({
      ...valid,
      input: encodeFunctionData({
        abi: VOUCHER_AWARD_SAFE_ABI,
        functionName: "execTransaction",
        args: [token, 0n, f.record.safe.data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, wrong],
      }),
    });
    await expect(f.chain.reconcile(f.record, hash)).rejects.toMatchObject({
      code: "transaction_unverified",
    });
    f.client.getTransaction.mockResolvedValue(valid);
    const read = f.client.readContract.getMockImplementation()!;
    f.client.readContract.mockImplementation((input) =>
      input.functionName === "nonce" ? Promise.resolve(8n) : read(input)
    );
    await expect(f.chain.reconcile(f.record, hash)).rejects.toMatchObject({
      code: "safe_nonce_changed",
    });
  });
});
