import { getPublicClient } from "@wagmi/core";
import { erc20Abi, type Hex } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import type { VoucherAwardRecord } from "../../public-contracts/voucher-awards";
import type { TransactionSender } from "../transactions/types";
import { prepareBatch } from "../transactions/prepared-batch";
import type { BatchRecord, VerifyBatchItems } from "../transactions/batch-types";
import {
  voucherAwardOwnerCall,
  voucherAwardSafeTypedData,
  VOUCHER_AWARD_SAFE_ABI,
} from "./voucher-award-safe";
import type { VoucherAwardClient } from "./voucher-award-client";

interface SendInput {
  record: VoucherAwardRecord;
  actor: Address;
  sender: TransactionSender;
  client: VoucherAwardClient;
  assertCurrent: () => void;
}
export interface VoucherAwardSendResult {
  record: VoucherAwardRecord;
  operation: BatchRecord | null;
}
function executionContext(input: SendInput) {
  let current = input.record;
  const verify: VerifyBatchItems = async ({ receipts, itemIds }) => {
    for (const receipt of receipts) {
      const result = await input.client.request({
        action: "reconcile",
        reserve: current.award.reserve,
        awardId: current.award.awardId,
        transactionHash: receipt.transactionHash,
      });
      current = result.record!;
      if (current.state === "confirmed") return [...itemIds];
    }
    return [];
  };
  const finish = async (operation: BatchRecord): Promise<VoucherAwardSendResult> => {
    for (const receipt of operation.receipts) {
      if (current.state === "confirmed") break;
      current = (
        await input.client.request({
          action: "reconcile",
          reserve: current.award.reserve,
          awardId: current.award.awardId,
          transactionHash: receipt.transactionHash,
        })
      ).record!;
    }
    return { record: current, operation };
  };
  return { verify, finish };
}
/** Recovery reads the journal's accepted submission; it never creates another Safe call. */
export async function recoverVoucherAward(input: SendInput): Promise<VoucherAwardSendResult> {
  input.assertCurrent();
  if (!input.sender.batches) throw new Error("Award recovery unavailable");
  const prefix = `voucher-award:${input.record.safe.safeTxHash}:`;
  const scope = { account: input.actor, chainId: 100 };
  const records = await input.sender.batches.list(scope);
  const found = records
    .filter((r) => r.id.startsWith(prefix))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!found) return { record: input.record, operation: null };
  const context = executionContext(input);
  return context.finish(await input.sender.batches.reconcile(found.id, scope, context.verify));
}
/** Only EOA owners can sign this direct path. Other owners keep the exact Safe handoff. */
export async function sendVoucherAward(input: SendInput): Promise<VoucherAwardSendResult> {
  input.assertCurrent();
  const sender = input.sender;
  if (!sender.batches || !sender.signTypedData) throw new Error("Award execution unavailable");
  const chain = getPublicClient(getWagmiConfig(), { chainId: 100 });
  if (!chain || chain.chain?.id !== 100) throw new Error("Award chain unavailable");
  const fresh = (
    await input.client.request({
      action: "read",
      reserve: input.record.award.reserve,
      awardId: input.record.award.awardId,
    })
  ).record!;
  if (fresh.state === "confirmed") return { record: fresh, operation: null };
  if (fresh.safe.safeTxHash !== input.record.safe.safeTxHash)
    throw new Error("Award review changed");
  const code = await chain.getCode({ address: input.actor });
  if (code && code !== "0x") throw new Error("Contract owners must use the Safe signing handoff");
  const existing = await sender.batches.list({ account: input.actor, chainId: 100 });
  if (
    existing.some(
      (r) =>
        r.id.startsWith(`voucher-award:${fresh.safe.safeTxHash}:`) &&
        ["submitted", "unresolved", "awaiting-approval"].includes(r.status)
    )
  )
    return recoverVoucherAward({ ...input, record: fresh });
  const preflight = async () => {
    input.assertCurrent();
    await sender.assertOwnership?.(input.actor, 100);
    const reviewed = (
      await input.client.request({
        action: "read",
        reserve: fresh.award.reserve,
        awardId: fresh.award.awardId,
      })
    ).record!;
    const [nonce, threshold, balance] = await Promise.all([
      chain.readContract({
        address: fresh.safe.safe,
        abi: VOUCHER_AWARD_SAFE_ABI,
        functionName: "nonce",
      }),
      chain.readContract({
        address: fresh.safe.safe,
        abi: VOUCHER_AWARD_SAFE_ABI,
        functionName: "getThreshold",
      }),
      chain.readContract({
        address: fresh.award.token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [fresh.award.reserve],
      }),
    ]);
    if (
      reviewed.state !== "awaiting_authorization" &&
      !(reviewed.state === "failed" && reviewed.failure === "transaction_reverted")
    )
      throw new Error("Award needs reconciliation before sending");
    if (
      nonce !== BigInt(fresh.safe.nonce) ||
      threshold !== 1n ||
      balance < BigInt(fresh.award.amount)
    )
      throw new Error("Safe authority, nonce or reserve changed");
  };
  await preflight();
  const signature = await sender.signTypedData(
    {
      account: input.actor,
      chainId: 100,
      data: voucherAwardSafeTypedData(fresh.award, BigInt(fresh.safe.nonce)),
    },
    { assertOwnership: input.assertCurrent }
  );
  input.assertCurrent();
  const call = await voucherAwardOwnerCall(fresh, input.actor, signature as Hex);
  const prepared = prepareBatch({
    id: `voucher-award:${fresh.safe.safeTxHash}:${input.actor.toLowerCase()}:${fresh.revision}`,
    domain: "voucher-award",
    account: input.actor,
    chainId: 100,
    mode: "single-call",
    budget: {
      maxCalls: 1,
      maxCalldataBytes: 32_768,
      maxGas: "2500000",
      maxFeePerGas: "100000000000",
      maxFee: "250000000000000000",
      sponsorship: sender.supportsSponsorship ? "required" : "wallet",
    },
    items: [{ id: fresh.award.awardId, call }],
  });
  const context = executionContext({ ...input, record: fresh });
  const operation = await sender.batches.execute(prepared, {
    preflight: async () => {
      await preflight();
      await chain.simulateContract({
        address: call.address,
        abi: VOUCHER_AWARD_SAFE_ABI,
        functionName: "execTransaction",
        args: call.args as never,
        account: input.actor,
      });
    },
    verify: context.verify,
  });
  return context.finish(operation);
}
