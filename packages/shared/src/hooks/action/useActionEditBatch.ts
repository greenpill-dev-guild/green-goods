import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { useAccount } from "wagmi";
import { toastService } from "../../components/toast";
import { actionsKeys, batchKeys } from "../../config/query-keys/garden";
import {
  type ActionEditBatchOutcome,
  type ActionEditChange,
  type ActionEditHold,
  actionEditBudget,
  actionEditDomain,
  createActionEditChain,
  moveOnFromActionEditHold,
  orderActionEditOnChain,
  readActionEditHold,
  sendActionEditBatch,
} from "../../modules/action/action-edit-batch";
import { isBatchEnabled } from "../../modules/transactions/batch-enablement";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useHeldBatches } from "../garden/useHeldBatches";

/**
 * Save an action's changed fields under one signature, and settle a save whose outcome is unknown.
 *
 * `available` says a save can go as one batch now: its rail is listed, and the sender reports
 * atomic. Recovery does not depend on that, so a hold from an earlier save still shows after
 * batching is switched off. A failed save is explained here, so a caller acts only on the outcome.
 */
export function useActionEditBatch(chainId: number, actionUID: bigint | null) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const sender = useTransactionSender();
  const { primaryAddress: account, passkeyAccountProfile } = useUser();
  const { connector } = useAccount();
  const handleError = createMutationErrorHandler({
    source: "useActionEditBatch",
    toastContext: "save action",
    formatMessage,
  });

  const batches = sender?.batches;
  const rail =
    sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
  const profile = rail === "wallet" ? "eip-5792" : passkeyAccountProfile;
  const listed = Boolean(
    batches &&
      account &&
      rail &&
      profile &&
      actionEditBudget(rail, chainId) &&
      isBatchEnabled({ action: "action-edit", rail, profile, chainId })
  );

  // Asked only once listed: until then no wallet hears from this hook.
  const { data: atomic = false } = useQuery({
    queryKey: batchKeys.capability(account ?? "", chainId, connector?.uid ?? ""),
    queryFn: async () => {
      const capability = await sender!.getBatchCapability!({ account: account!, chainId });
      return capability.atomic === "supported";
    },
    enabled: listed,
    retry: false,
  });

  const domain = actionUID === null ? "" : actionEditDomain(chainId, actionUID);
  const holdKey = batchKeys.hold(domain, account ?? "", chainId);
  const batchInput = () => ({
    batches: batches!,
    chain: createActionEditChain(chainId),
    actionUID: actionUID!,
    scope: { account: account!, chainId },
  });
  const refreshActions = () =>
    void queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) });

  const sendBatch = useMutation({
    onMutate: () => queryClient.cancelQueries({ queryKey: holdKey }),
    mutationFn: async (changes: readonly ActionEditChange[]): Promise<ActionEditBatchOutcome> => {
      try {
        const outcome = await sendActionEditBatch({ ...batchInput(), rail: rail!, changes });
        if (outcome.status === "not-saved")
          toastService.error({
            title: formatMessage({ id: "app.actions.edit.notSaved" }),
            context: "save action",
          });
        return outcome;
      } catch (error) {
        handleError(error, { authMode: rail });
        return { status: "not-saved" };
      }
    },
    onSuccess: (outcome) => {
      if (outcome.status === "saved") refreshActions();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: holdKey }),
  });

  const held = useHeldBatches<ActionEditHold, ActionEditChange>({
    domain,
    account,
    chainId,
    enabled: Boolean(batches && account && actionUID !== null) && !sendBatch.isPending,
    read: (shown) => readActionEditHold(batchInput(), shown),
    moveOn: (hold) => moveOnFromActionEditHold(batchInput(), hold),
    onSaved: refreshActions,
    onError: (error) => handleError(error, { authMode: rail }),
  });

  return {
    ...held,
    available: listed && atomic,
    isSending: sendBatch.isPending,
    send: (changes: readonly ActionEditChange[]) => sendBatch.mutateAsync(changes),
    /** For a save that goes one write at a time: the registry checks each against the last. */
    order: (changes: readonly ActionEditChange[]) =>
      orderActionEditOnChain({
        chainId,
        actionUID: actionUID!,
        changes,
        chain: createActionEditChain(chainId),
      }),
  };
}
