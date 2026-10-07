import { createPublicClientForChain } from "../../config/pimlico";
import type { MarketplacePendingSubmission } from "../../stores/useMarketplacePendingStore";
import { assertMarketplaceReady } from "../../utils/blockchain/contracts";
import { MARKETPLACE_ADAPTER_ABI } from "../../utils/blockchain/hypercert-abis";
import type { Address } from "../../types/domain";
import type { BroadcastConfirmation, TransactionSender } from "../transactions/types";

/** Opaque wallet proposals are never passed to an execution-receipt reader. */
export async function readMarketplaceSubmissionOutcome(
  pending: MarketplacePendingSubmission,
  sender: TransactionSender | null,
  chainId: number
): Promise<BroadcastConfirmation> {
  const reference = pending.reference;
  if (!reference) return { status: "unresolved" };
  try {
    if (reference.kind === "user-operation")
      return (await sender?.reconcileBroadcast?.(reference)) ?? { status: "unresolved" };
    if (!/^0x[\da-f]{64}$/i.test(reference.hash)) return { status: "unresolved" };
    const receipt = await createPublicClientForChain(chainId).getTransactionReceipt({
      hash: reference.hash,
    });
    return receipt.status === "reverted"
      ? { status: "reverted" }
      : { status: "confirmed", transactionHash: receipt.transactionHash };
  } catch {
    return { status: "unresolved" };
  }
}

/** Matching the exact signed orders proves registration; unrelated active orders do not. */
export async function isPendingBatchRegistered(
  pending: Extract<MarketplacePendingSubmission, { kind: "batch" }>,
  signer: Address,
  chainId: number
): Promise<boolean> {
  const address = assertMarketplaceReady(chainId).addresses.marketplaceAdapter;
  const client = createPublicClientForChain(chainId);
  const found = await Promise.all(
    pending.orders.map(async (order) => {
      const orderId = await client.readContract({
        address,
        abi: MARKETPLACE_ADAPTER_ABI,
        functionName: "activeOrders",
        args: [BigInt(order.hypercertId), order.currency],
      });
      if (orderId === 0n) return false;
      const registered = await client.readContract({
        address,
        abi: MARKETPLACE_ADAPTER_ABI,
        functionName: "orders",
        args: [orderId],
      });
      return (
        registered[0] === BigInt(order.hypercertId) &&
        registered[2].toLowerCase() === order.signature.toLowerCase() &&
        registered[6].toLowerCase() === signer.toLowerCase()
      );
    })
  );
  return found.length > 0 && found.every(Boolean);
}
