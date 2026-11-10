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

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import type {
  PoolFundingControllerView,
  ProtocolFundingOperationsController,
  ProtocolFundingRow,
  SettlementActKind,
  SettlementActStatus,
} from "./controller.types";
import {
  type PoolFundingTransferBlock,
  selectQueuedTransferBlock,
  selectTransferBlock,
} from "../../../modules/commitment-pooling/pool-funding";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { selectSettlementActions } from "../../../modules/commitment-pooling/settlement";
import { pinCommitmentReason } from "../../../modules/commitment-pooling/reasons";
import type { HexString } from "../../../modules/commitment-pooling/types-core";
import type { BroadcastConfirmation } from "../../../modules/transactions/types";
import type { Address } from "../../../types/domain";
import { ZERO_ADDRESS } from "../../../utils/blockchain/address";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { usePoolFunding } from "../../commitment-pooling/usePoolFunding";
import {
  useSettlementMutation,
  useSettlementOperationsCapabilities,
} from "../../commitment-pooling/useSettlement";
import { useRole } from "../../gardener/useRole";

type FundingRead = ReturnType<typeof usePoolFunding>["snapshot"];

type FundingAct =
  | { action: "queueFunding"; garden: Address; amount: bigint }
  | { action: "dispatchDisbursement" | "retryCommand" | "requeue"; disbursementId: bigint }
  | { action: "cancelDisbursement"; disbursementId: bigint; reasonCID: string };

/**
 * What a proposal will change once it runs, against the read it was sent from: a
 * new funding transfer numbered above every transfer that read listed, or one
 * transfer leaving the state it stood in.
 */
type ProposedEffect =
  | { kind: "new-transfer"; garden: Address; amount: bigint; after: bigint }
  | { kind: "transfer-moves"; disbursementId: bigint; from: string | null };

/**
 * The state one transfer stands in; null when the read doesn't list it. Its Celo
 * execution is left out: Celo can update that while a proposal waits, and only a
 * new state ends any repeat of the act.
 */
function transferState(read: FundingRead, disbursementId: bigint): string | null {
  return (
    read?.disbursements.find((entry) => entry.disbursementId === disbursementId)?.state ?? null
  );
}

function proposedEffect(act: FundingAct, read: FundingRead): ProposedEffect {
  if (act.action === "queueFunding") {
    const after = (read?.disbursements ?? []).reduce(
      (highest, row) => (row.disbursementId > highest ? row.disbursementId : highest),
      0n
    );
    return { kind: "new-transfer", garden: act.garden, amount: act.amount, after };
  }
  return {
    kind: "transfer-moves",
    disbursementId: act.disbursementId,
    from: transferState(read, act.disbursementId),
  };
}

/** A proposal a Safe took, by the identifier its wallet returned, and what it will change. */
interface Proposal {
  hash: HexString;
  effect: ProposedEffect;
}

/** Whether the wallet has run a proposal, as `reconcileBroadcast` reads it. */
type ProposalOutcome = BroadcastConfirmation["status"];

/** How often a held panel asks the wallet again, on the funding read's own cadence. */
const PROPOSAL_RECHECK_MS = 30_000;

/** Whether the read lists what the proposal will change. */
function effectShown(effect: ProposedEffect, read: FundingRead): boolean {
  if (!read) return false;
  if (effect.kind === "transfer-moves") {
    const now = transferState(read, effect.disbursementId);
    return now !== null && now !== effect.from;
  }
  const source = read.safe?.toLowerCase();
  return read.disbursements.some(
    (row) =>
      row.kind === "FUNDING" &&
      row.source.toLowerCase() === source &&
      row.garden?.toLowerCase() === effect.garden.toLowerCase() &&
      row.amount === effect.amount &&
      row.disbursementId > effect.after
  );
}

/**
 * Whether a proposal is done holding sends, so the same act can't be proposed twice:
 * the wallet says it reverted or ran, or its own change shows. A dispatch, resend,
 * requeue or cancel settles when the wallet says it ran or its transfer leaves the
 * state it stood in, after which the act is no longer offered. A new transfer like
 * the one queued could be another steward's, so it needs both.
 */
function proposalSettled(proposal: Proposal, outcome: ProposalOutcome, read: FundingRead) {
  if (outcome === "reverted") return true;
  const { effect } = proposal;
  if (effect.kind === "transfer-moves") return outcome === "confirmed" || effectShown(effect, read);
  return outcome === "confirmed" && effectShown(effect, read);
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
  const { isProtocolTeam } = useRole();
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
    isProtocolTeam,
  });
  const mutation = useSettlementMutation({ chainId });
  const sender = useTransactionSender();
  const [lastAct, setLastAct] = useState<SettlementActStatus | null>(null);
  // An act a Safe took as a proposal. Sends stay closed until it settles, so the act
  // can't be proposed twice. This lasts as long as the panel: reloading is how a
  // proposal the Safe never runs is sent again.
  const [proposed, setProposed] = useState<Proposal | null>(null);
  const asksWallet = proposed !== null && Boolean(sender?.reconcileBroadcast);
  const outcomeQuery = useQuery({
    queryKey: commitmentPoolingKeys.settlementProposal(chainId, proposed?.hash ?? ""),
    queryFn: async (): Promise<ProposalOutcome> => {
      if (!proposed || !sender?.reconcileBroadcast) return "unresolved";
      const outcome = await sender.reconcileBroadcast({
        kind: "transaction",
        hash: proposed.hash,
        chainId,
        ...(viewer ? { account: viewer } : {}),
      });
      return outcome.status;
    },
    enabled: asksWallet,
    refetchInterval: (query) =>
      query.state.data === undefined || query.state.data === "unresolved"
        ? PROPOSAL_RECHECK_MS
        : false,
    retry: false,
  });
  const outcome: ProposalOutcome = outcomeQuery.data ?? "unresolved";
  const proposalPending =
    proposed !== null && !proposalSettled(proposed, outcome, sourceQuery.snapshot);
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
        const sendBlock = selectQueuedTransferBlock(funding, row);
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

  // A refresh also asks the wallet again about a proposal it is holding for.
  const refetch = useCallback(async () => {
    return Promise.all([
      sourceQuery.refetch(),
      targetQuery.refetch(),
      ...(asksWallet ? [outcomeQuery.refetch()] : []),
    ]);
  }, [asksWallet, outcomeQuery, sourceQuery, targetQuery]);

  const run = useCallback(
    async (
      kind: SettlementActKind,
      action: FundingAct,
      /** Asks the latest read why this can't go, when the send can spend the CCIP fee. */
      blockOf?: (
        funding: Parameters<typeof selectQueuedTransferBlock>[0]
      ) => PoolFundingTransferBlock | null
    ): Promise<HexString> => {
      setLastAct({ kind, phase: "signing" });
      let before = sourceQuery.snapshot;
      try {
        if (blockOf) {
          // The rows and the review read a snapshot up to 30 seconds old; the send reads again.
          const fresh = await sourceQuery.refetch();
          const block = blockOf({
            snapshot: fresh.data ?? null,
            isError: fresh.isError,
            hasStaleBalance: false,
          });
          if (block) throw new Error(`The protocol Safe can't send this transfer: ${block}`);
          before = fresh.data ?? null;
        }
        const result = await mutation.mutateAsync(action);
        const hash = result.hash as HexString;
        if (result.confirmation === "pending") {
          setProposed({ hash, effect: proposedEffect(action, before) });
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

  /** A queued or dispatched transfer as the read holds it; one it no longer holds is not sent. */
  const transferOf = (disbursementId: bigint) => {
    const row = sourceQuery.snapshot?.disbursements.find(
      (entry) => entry.disbursementId === disbursementId
    );
    if (!row) throw new Error(`Transfer #${disbursementId.toString()} is not in the latest read`);
    return (funding: Parameters<typeof selectQueuedTransferBlock>[0]) =>
      selectQueuedTransferBlock(funding, row);
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
    // Once a proposal settles, it either reverted on chain or ran, and the indexed rows say how.
    lastAct:
      lastAct?.phase === "proposed" && !proposalPending
        ? outcome === "reverted"
          ? {
              kind: lastAct.kind,
              phase: "failed",
              error: new Error("The Safe ran the proposal and it reverted"),
            }
          : { ...lastAct, phase: "submitted" }
        : lastAct,
    isActing,
    queueFunding: (garden, amount) =>
      run("queue-funding", { action: "queueFunding", garden, amount }, (funding) =>
        selectTransferBlock(funding, amount)
      ),
    dispatch: async (disbursementId) =>
      run(
        "dispatch",
        { action: "dispatchDisbursement", disbursementId },
        transferOf(disbursementId)
      ),
    retry: async (disbursementId) =>
      run("retry", { action: "retryCommand", disbursementId }, transferOf(disbursementId)),
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
