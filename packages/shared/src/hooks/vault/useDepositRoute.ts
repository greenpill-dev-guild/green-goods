import { useQueryClient } from "@tanstack/react-query";
import { batchKeys } from "../../config/query-keys/garden";
import {
  createDepositChain,
  type DepositOutcome,
  type DepositTarget,
  depositDomain,
  sendDepositBatch,
} from "../../modules/garden/deposit-batch";
import { depositRoute, walletRouteListed } from "../../modules/garden/deposit-route";
import { assertBatchCapabilityKnown } from "../../modules/transactions/batch-types";
import { TransactionConfirmationPendingError } from "../../modules/transactions/types";
import type { Address } from "../../types/domain";
import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";

/**
 * How a deposit goes now, and the send on that route. Vaults and jars share it so an unknown
 * outcome and a declined signature end the same way for both: each throws what the forms read.
 */
export function useDepositRoute(action: "vault-deposit" | "jar-deposit") {
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress, passkeyAccountProfile } = useUser();
  const sender = useTransactionSender();

  return {
    /** Null for today's flow. Asked at the send, so it is never stale. */
    routeFor: async (asset: Address) => {
      const rail =
        sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
      if (!sender?.batches || !primaryAddress) return null;
      let walletAtomic: boolean | undefined;
      if (rail === "wallet" && walletRouteListed({ action, chainId, asset })) {
        const capability = await sender.getBatchCapability?.({ account: primaryAddress, chainId });
        assertBatchCapabilityKnown(capability);
        walletAtomic = capability?.atomic === "supported";
      }
      const route = depositRoute({
        action,
        rail,
        passkeyProfile: passkeyAccountProfile,
        walletAtomic,
        chainId,
        asset,
      });
      return route && rail ? { ...route, rail, batches: sender.batches } : null;
    },

    send: async (
      route: Pick<Parameters<typeof sendDepositBatch>[0], "atomic" | "rail" | "batches">,
      input: { target: DepositTarget; amount: bigint; checkBeforeDeposit: () => Promise<void> }
    ): Promise<Extract<DepositOutcome, { status: "deposited" | "reverted" }>> => {
      const account = primaryAddress as Address;
      const overCeilingsKey = batchKeys.overCeilings(
        depositDomain(input.target),
        account,
        chainId,
        input.amount.toString()
      );
      const tookOneSignature = route.atomic && !queryClient.getQueryData(overCeilingsKey);
      const outcome = await sendDepositBatch({
        ...input,
        batches: route.batches,
        rail: route.rail,
        atomic: tookOneSignature,
        chain: createDepositChain(chainId),
        scope: { account, chainId },
      }).catch((error: unknown) => {
        // It was promised one signature, so going step by step takes another press.
        if (tookOneSignature && classifyTxError(error).kind === "overCeilings") {
          queryClient.setQueryData(overCeilingsKey, true);
        }
        throw error;
      });
      if (outcome.status === "unknown") throw new TransactionConfirmationPendingError();
      if (outcome.status === "declined") throw new Error("Transaction cancelled");
      return outcome;
    },
  };
}
