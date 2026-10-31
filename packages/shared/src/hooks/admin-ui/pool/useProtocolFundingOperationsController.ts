/**
 * Protocol funding operations controller
 *
 * Keeps discretionary Protocol-to-Garden funding separate from commitment
 * payout plans. Authority follows the deployed SettlementModule exactly:
 * protocol stewards or the module owner may queue; executor-garden stewards
 * or the dispatcher may dispatch/retry; only executor-garden stewards may
 * requeue/cancel.
 *
 * @module hooks/admin-ui/pool/useProtocolFundingOperationsController
 */

import { useCallback, useMemo, useState } from "react";

import type {
  PoolFundingControllerView,
  ProtocolFundingOperationsController,
  ProtocolFundingRow,
  SettlementActKind,
  SettlementActStatus,
} from "./controller.types";
import { selectTransferBlock } from "../../../modules/commitment-pooling/pool-funding";
import { selectSettlementActions } from "../../../modules/commitment-pooling/settlement";
import { pinCommitmentReason } from "../../../modules/commitment-pooling/reasons";
import type { HexString } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import { ZERO_ADDRESS } from "../../../utils/blockchain/address";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { usePoolFunding } from "../../commitment-pooling/usePoolFunding";
import {
  useSettlementMutation,
  useSettlementOperationsCapabilities,
} from "../../commitment-pooling/useSettlement";
import { useRole } from "../../gardener/useRole";

function transfersKey(snapshot: ReturnType<typeof usePoolFunding>["snapshot"]): string | null {
  return snapshot
    ? snapshot.disbursements.map((row) => `${row.disbursementId}:${row.state}`).join(",")
    : null;
}

function fundingView(query: ReturnType<typeof usePoolFunding>): PoolFundingControllerView {
  return {
    snapshot: query.snapshot,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    hasStaleBalance: query.hasStaleBalance,
    lastReadAt: query.lastReadAt,
    ledgerReadAt: query.ledgerReadAt,
    refetch: query.refetch,
  };
}

export function useProtocolFundingOperationsController(input: {
  chainId: number;
  protocolGarden: Address | null;
  targetGarden: Address | null;
}): ProtocolFundingOperationsController {
  const { chainId, protocolGarden, targetGarden } = input;
  const viewer = usePrimaryAddress() ?? undefined;
  const isOnline = useOnlineStatus();
  const { isDeployer } = useRole();
  const sourceQuery = usePoolFunding(
    { chainId, garden: protocolGarden ?? ZERO_ADDRESS },
    { enabled: Boolean(protocolGarden) }
  );
  const targetQuery = usePoolFunding(
    { chainId, garden: targetGarden ?? ZERO_ADDRESS },
    { enabled: Boolean(targetGarden) }
  );
  const capabilities = useSettlementOperationsCapabilities({
    chainId,
    account: viewer,
    protocolGarden,
    executorGarden: protocolGarden,
    isDeployer,
  });
  const mutation = useSettlementMutation({ chainId });
  const [lastAct, setLastAct] = useState<SettlementActStatus | null>(null);
  // The transfers as they stood when a Safe took an act as a proposal. Sends stay
  // closed while the list still reads the same, so nothing goes out twice. This
  // lasts as long as the panel: reloading is how a rejected proposal is sent again.
  const [proposedAt, setProposedAt] = useState<string | null>(null);
  const proposalPending = proposedAt !== null && transfersKey(sourceQuery.snapshot) === proposedAt;
  // From the first tap: a send reads the Safe again before the wallet is asked.
  const isActing = mutation.isPending || lastAct?.phase === "signing";
  const canAct = Boolean(viewer) && isOnline && !isActing && !capabilities.isLoading;
  const canSend = canAct && !proposalPending;

  const rows = useMemo<ProtocolFundingRow[]>(() => {
    const snapshot = sourceQuery.snapshot;
    if (!snapshot?.safe) return [];
    const funding = {
      snapshot,
      isError: sourceQuery.isError,
      hasStaleBalance: sourceQuery.hasStaleBalance,
    };
    const sourceSafe = snapshot.safe.toLowerCase();
    const executions = new Map(
      snapshot.executions.map((execution) => [execution.executionKey.toLowerCase(), execution])
    );
    return snapshot.disbursements
      .filter((row) => row.kind === "FUNDING" && row.source.toLowerCase() === sourceSafe)
      .map((row) => {
        const execution = row.executionKey
          ? executions.get(row.executionKey.toLowerCase())
          : undefined;
        const actions = selectSettlementActions({
          state: row.state,
          isBatch: Boolean(row.batchId),
          isBatchMember: Boolean(row.batchId),
          kind: "FUNDING",
          sourcePaused: snapshot.settlementUnavailableReasons.includes("source_paused"),
          canDispatchOrRetry: capabilities.canDispatchOrRetry && canSend,
          canRequeueOrCancel: capabilities.canRequeueOrCancel && canSend,
        });
        // A dispatch or resend spends the CCIP fee before Celo can refuse it.
        const dispatchable = actions.dispatch && !row.batchId;
        const resendable = actions.retrySameCommand && execution?.status !== "SUCCESS";
        const sendBlock = selectTransferBlock(funding, row.amount);
        const state: ProtocolFundingRow["state"] =
          row.state === "DISPATCHED" &&
          execution?.status === "SUCCESS" &&
          !execution.acknowledgmentSent
            ? "acknowledgement-pending"
            : (row.state.toLowerCase() as ProtocolFundingRow["state"]);
        return {
          id: row.id,
          disbursementId: row.disbursementId,
          garden: row.garden ?? null,
          recipient: row.recipient,
          amount: row.amount,
          state,
          executionKey: row.executionKey,
          canDispatch: dispatchable && !sendBlock,
          canRetry: resendable && !sendBlock,
          canRequeue: actions.startNewAttempt,
          canCancel: actions.cancelIndividual,
          sendBlock: dispatchable || resendable ? sendBlock : null,
        };
      })
      .sort((left, right) => (left.disbursementId > right.disbursementId ? -1 : 1));
  }, [
    canSend,
    capabilities,
    sourceQuery.snapshot,
    sourceQuery.isError,
    sourceQuery.hasStaleBalance,
  ]);

  const refetch = useCallback(async () => {
    return Promise.all([sourceQuery.refetch(), targetQuery.refetch()]);
  }, [sourceQuery, targetQuery]);

  const run = useCallback(
    async (
      kind: SettlementActKind,
      action:
        | { action: "queueFunding"; garden: Address; amount: bigint }
        | { action: "dispatchDisbursement" | "retryCommand" | "requeue"; disbursementId: bigint }
        | { action: "cancelDisbursement"; disbursementId: bigint; reasonCID: string },
      /** What this send takes out of the protocol Safe, when it can spend the CCIP fee. */
      sendAmount?: bigint
    ): Promise<HexString> => {
      setLastAct({ kind, phase: "signing" });
      let before = transfersKey(sourceQuery.snapshot);
      try {
        if (sendAmount !== undefined) {
          // The rows and the review read a snapshot up to 30 seconds old; the send reads again.
          const fresh = await sourceQuery.refetch();
          const block = selectTransferBlock(
            { snapshot: fresh.data ?? null, isError: fresh.isError, hasStaleBalance: false },
            sendAmount
          );
          if (block) throw new Error(`The protocol Safe can't send this transfer: ${block}`);
          before = transfersKey(fresh.data ?? null);
        }
        const result = await mutation.mutateAsync(action);
        const hash = result.hash as HexString;
        if (result.confirmation === "pending") {
          setProposedAt(before);
          setLastAct({ kind, phase: "proposed", hash });
        } else {
          setLastAct({ kind, phase: "submitted", hash });
        }
        await refetch();
        return hash;
      } catch (error) {
        setLastAct({ kind, phase: "failed", error });
        await refetch().catch(() => undefined);
        throw error;
      }
    },
    [mutation, refetch, sourceQuery]
  );

  /** What a queued or dispatched transfer carries; a row the read no longer holds is not sent. */
  const amountOf = (disbursementId: bigint): bigint => {
    const row = sourceQuery.snapshot?.disbursements.find(
      (entry) => entry.disbursementId === disbursementId
    );
    if (!row) throw new Error(`Transfer #${disbursementId.toString()} is not in the latest read`);
    return row.amount;
  };

  return {
    chainId,
    viewer,
    protocolGarden,
    targetGarden,
    isOnline,
    canQueueFunding: capabilities.canQueueFunding && canAct,
    canDispatchOrRetry: capabilities.canDispatchOrRetry && canAct,
    canRequeueOrCancel: capabilities.canRequeueOrCancel && canAct,
    authorityResolved: !capabilities.isLoading,
    showOperations: capabilities.showOperations,
    sourceFunding: fundingView(sourceQuery),
    targetFunding: fundingView(targetQuery),
    rows,
    // Once the list moves, the proposal ran and the indexed rows say how it went.
    lastAct:
      lastAct?.phase === "proposed" && !proposalPending
        ? { ...lastAct, phase: "submitted" }
        : lastAct,
    isActing,
    queueFunding: (garden, amount) =>
      run("queue-funding", { action: "queueFunding", garden, amount }, amount),
    dispatch: async (disbursementId) =>
      run("dispatch", { action: "dispatchDisbursement", disbursementId }, amountOf(disbursementId)),
    retry: async (disbursementId) =>
      run("retry", { action: "retryCommand", disbursementId }, amountOf(disbursementId)),
    requeue: (disbursementId) => run("requeue", { action: "requeue", disbursementId }),
    cancel: async (disbursementId, reason) => {
      const reasonCID = await pinCommitmentReason({
        reason,
        gardenAddress: protocolGarden,
        source: "cancelFundingDisbursement",
      });
      return run("cancel", { action: "cancelDisbursement", disbursementId, reasonCID });
    },
    refetch,
  };
}
