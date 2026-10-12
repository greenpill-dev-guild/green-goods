import type { QueryClient } from "@tanstack/react-query";
import type { Address } from "../../types/domain";
import {
  TransactionRevertedError,
  type TransactionSender,
  type TxResult,
} from "../../modules/transactions/types";
import {
  trackAdminGardenCreateFailed,
  trackAdminGardenCreateSuccess,
} from "../../modules/app/analytics-events";
import { createDefaultCreateGardenPorts } from "../../modules/garden/create-garden-command";
import { useCreateGardenStore } from "../../stores/useCreateGardenStore";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { queryInvalidation } from "../../config/query-keys/invalidation";
interface GardenRecoveryDependencies {
  address?: Address;
  chainId: number;
  sender: TransactionSender | null;
  updateTransactionStatus: (hash: string, status: "failed" | "confirmed") => void;
  queryClient: QueryClient;
  scheduleGardenRefresh: () => void;
}
export async function reconcileGardenRecovery(
  input: TxResult,
  signal: AbortSignal,
  getDependencies: () => GardenRecoveryDependencies
) {
  const { address: activeAddress, chainId: activeChainId } = getDependencies();
  const pending = activeAddress
    ? useCreateGardenStore.getState().getPendingSubmission(activeAddress, activeChainId)
    : undefined;
  const { address: currentAddress, sender: currentSender } = getDependencies();
  if (
    !pending ||
    !currentSender ||
    currentAddress?.toLowerCase() !== pending.accountAddress.toLowerCase() ||
    getDependencies().chainId !== pending.chainId
  )
    return input;
  const ports = createDefaultCreateGardenPorts({
    transactionSender: currentSender,
    addPending: () => {},
  });
  const outcome =
    pending.result.confirmation !== "pending"
      ? { status: "confirmed" as const, transactionHash: pending.result.hash }
      : await ports.sender.reconcile(
          pending.result.hash,
          pending.chainId,
          pending.result.broadcastReference
        );
  if (
    signal.aborted ||
    useCreateGardenStore
      .getState()
      .getPendingSubmission(pending.accountAddress, pending.chainId) !== pending ||
    getDependencies().address?.toLowerCase() !== pending.accountAddress.toLowerCase() ||
    getDependencies().chainId !== pending.chainId
  )
    return input;
  if (outcome.status === "unresolved") return input;
  if (outcome.status === "reverted") {
    getDependencies().updateTransactionStatus(pending.result.hash, "failed");
    trackAdminGardenCreateFailed({
      gardenName: pending.gardenName,
      chainId: pending.chainId,
      error: "TransactionReverted",
    });
    useCreateGardenStore.getState().clearPendingSubmission(pending.accountAddress, pending.chainId);
    throw new TransactionRevertedError(pending.result.hash, "Garden creation transaction reverted");
  }
  if (outcome.status !== "confirmed") return input;
  getDependencies().updateTransactionStatus(pending.result.hash, "confirmed");
  if (!pending.successTracked)
    trackAdminGardenCreateSuccess({
      gardenName: pending.gardenName,
      gardenAddress: getNetworkContracts(pending.chainId).gardenToken,
      chainId: pending.chainId,
      txHash: outcome.transactionHash,
    });
  queryInvalidation
    .invalidateGardens(pending.chainId)
    .forEach((queryKey) => getDependencies().queryClient.invalidateQueries({ queryKey }));
  getDependencies().scheduleGardenRefresh();
  useCreateGardenStore.getState().recordPendingSubmission({
    ...pending,
    successTracked: true,
    result: { ...pending.result, hash: outcome.transactionHash, confirmation: undefined },
  });
  return { hash: outcome.transactionHash, sponsored: input.sponsored };
}
