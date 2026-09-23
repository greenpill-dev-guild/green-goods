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
  const canAct = Boolean(viewer) && isOnline && !mutation.isPending && !capabilities.isLoading;

  const rows = useMemo<ProtocolFundingRow[]>(() => {
    const snapshot = sourceQuery.snapshot;
    if (!snapshot?.safe) return [];
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
          canDispatchOrRetry: capabilities.canDispatchOrRetry && canAct,
          canRequeueOrCancel: capabilities.canRequeueOrCancel && canAct,
        });
        const state: ProtocolFundingRow["state"] =
          row.state === "DISPATCHED" &&
          execution?.status === "SUCCESS" &&
          !execution.acknowledgmentSent
            ? "acknowledgement-pending"
            : (row.state.toLowerCase() as ProtocolFundingRow["state"]);
        return {
          id: row.id,
          disbursementId: row.disbursementId,
          recipient: row.recipient,
          amount: row.amount,
          state,
          executionKey: row.executionKey,
          canDispatch: actions.dispatch && !row.batchId,
          canRetry: actions.retrySameCommand && execution?.status !== "SUCCESS",
          canRequeue: actions.startNewAttempt,
          canCancel: actions.cancelIndividual,
        };
      })
      .sort((left, right) => (left.disbursementId > right.disbursementId ? -1 : 1));
  }, [canAct, capabilities, sourceQuery.snapshot]);

  const refetch = useCallback(async () => {
    return Promise.all([sourceQuery.refetch(), targetQuery.refetch()]);
  }, [sourceQuery, targetQuery]);

  const run = useCallback(
    async (
      kind: SettlementActKind,
      action:
        | { action: "queueFunding"; garden: Address; amount: bigint }
        | { action: "dispatchDisbursement" | "retryCommand" | "requeue"; disbursementId: bigint }
        | { action: "cancelDisbursement"; disbursementId: bigint; reasonCID: string }
    ): Promise<HexString> => {
      setLastAct({ kind, phase: "signing" });
      try {
        const hash = (await mutation.mutateAsync(action)) as HexString;
        setLastAct({ kind, phase: "submitted", hash });
        await refetch();
        return hash;
      } catch (error) {
        setLastAct({ kind, phase: "failed", error });
        await refetch().catch(() => undefined);
        throw error;
      }
    },
    [mutation, refetch]
  );

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
    lastAct,
    isActing: mutation.isPending,
    queueFunding: (garden, amount) =>
      run("queue-funding", { action: "queueFunding", garden, amount }),
    dispatch: (disbursementId) =>
      run("dispatch", { action: "dispatchDisbursement", disbursementId }),
    retry: (disbursementId) => run("retry", { action: "retryCommand", disbursementId }),
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
