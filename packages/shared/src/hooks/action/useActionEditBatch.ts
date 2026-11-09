import { useBatchCapability } from "../blockchain/useBatchCapability";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { actionsKeys, batchKeys } from "../../config/query-keys/garden";
import {
  type ActionEditChange,
  createActionEditChain,
  orderActionEditOnChain,
} from "../../modules/action/action-edit";
import {
  type ActionEditBatchOutcome,
  type ActionEditHold,
  actionEditBudget,
  actionEditDomain,
  moveOnFromActionEditHold,
  readActionEditHold,
  sendActionEditBatch,
} from "../../modules/action/action-edit-batch";
import { isBatchEnabled } from "../../modules/transactions/batch-enablement";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useHeldBatches } from "../garden/useHeldBatches";

const HOLD_FIELD_LABELS = {
  title: "app.assessment.table.title",
  startTime: "app.actions.detail.startTime",
  endTime: "app.actions.detail.endTime",
} as const;

/**
 * Save action changes with durable recovery, atomically on listed routes.
 *
 * `available` says a save can go as one batch now: its rail is listed, and the sender reports
 * atomic. Recovery does not depend on that, so a hold from an earlier save still shows after
 * batching is switched off. A failed save is explained here, so a caller acts only on the outcome.
 */
export function useActionEditBatch(chainId: number, actionUID: bigint | null) {
  const { formatDate, formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const sender = useTransactionSender();
  const { primaryAddress: account, passkeyAccountProfile } = useUser();
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

  // Asked only once listed: until then no wallet hears from this hook. Other batches share this
  // key, so it holds the wallet's answer itself.
  const { data: capability } = useBatchCapability({
    sender,
    account,
    chainId,
    enabled: listed,
  });

  const available = listed && capability === "supported";
  const journaled = Boolean(
    batches && account && rail === "wallet" && actionEditBudget(rail, chainId)
  );
  type SendOptions = { atomic?: boolean; onSaved?: (changes: ActionEditChange[]) => void };

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
    mutationFn: async ({
      changes,
      options,
    }: {
      changes: readonly ActionEditChange[];
      options: SendOptions;
    }): Promise<ActionEditBatchOutcome> => {
      let savedCount = 0;
      try {
        const outcome = await sendActionEditBatch({
          ...batchInput(),
          rail: rail!,
          changes,
          atomic: options.atomic ?? (rail === "wallet" ? available : true),
          onSaved: (saved) => {
            savedCount += saved.length;
            options.onSaved?.(saved);
            // Refresh on the next visit without replacing the active editor's remaining draft.
            void queryClient.invalidateQueries({
              queryKey: actionsKeys.byChain(chainId),
              refetchType: "none",
            });
          },
        });
        if (outcome.status === "not-saved")
          toastService.error({
            title: formatMessage({
              id: savedCount ? "app.actions.edit.failed" : "app.actions.edit.notSaved",
            }),
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

  /** What the action holds now, for each field a held save wrote. */
  const onChainLine = (hold: ActionEditHold, change: ActionEditChange) => {
    if (change.field === "instructions")
      return formatMessage({
        id: hold.attempted.some(
          (attempt) => attempt.field === "instructions" && attempt.value === change.value
        )
          ? "app.actions.edit.hold.instructionsSent"
          : "app.actions.edit.hold.instructionsEarlier",
      });
    return formatMessage(
      { id: "app.actions.edit.hold.onChain" },
      {
        field: formatMessage({ id: HOLD_FIELD_LABELS[change.field] }),
        value:
          typeof change.value === "number"
            ? formatDate(change.value * 1000, { dateStyle: "medium", timeStyle: "short" })
            : change.value,
      }
    );
  };
  const { hold } = held;

  return {
    ...held,
    holdFeedback: hold
      ? {
          title: formatMessage({ id: "app.actions.edit.hold.title" }),
          message: formatMessage({ id: "app.actions.edit.hold.body" }),
          detail: hold.onChain.map((change) => onChainLine(hold, change)).join(" · "),
          hasUnreadValues: hold.onChain.length < hold.fields.length,
          isSettling: held.isSettlingHold,
          onCheckAgain: () => void held.checkAgain(),
          onMoveOn: () => void held.moveOn(),
        }
      : null,
    available,
    /** Plain-wallet saves keep one prompt per field, with durable recovery. */
    journaled,
    isSending: sendBatch.isPending,
    send: (changes: readonly ActionEditChange[], options: SendOptions = {}) =>
      sendBatch.mutateAsync({ changes, options }),
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
