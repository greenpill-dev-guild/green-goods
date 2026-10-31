import type { Address } from "../../types/domain";
import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import {
  BatchConfirmationPendingError,
  BatchNotSubmittedError,
  batchReferenceKey,
  type BatchExecution,
  type BatchGroup,
  type BatchReceipt,
  type BatchRecord,
  type BatchReference,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES as waiting,
  type VerifyBatchItems,
} from "./batch-types";
import { assertBatchQuote } from "./batch-budget";
import type { BatchJournal } from "./batch-journal";
import { mergeReceipts, withBatchProgress } from "./batch-progress";
import type { BroadcastReference, TransactionSender } from "./types";
import { isCanonicalTransactionHash } from "./confirmation";

interface RecoveryInput {
  journal: BatchJournal;
  sender: TransactionSender;
  verify: VerifyBatchItems;
}
interface ExecutionInput extends RecoveryInput {
  prepared: PreparedBatch;
  /** Domain/transport preflight must simulate the exact reviewed group and enforce its budget. */
  preflight: (prepared: PreparedBatch, itemIds: readonly string[]) => Promise<void>;
}

async function owned(sender: TransactionSender, prepared: PreparedBatch) {
  await sender.assertOwnership?.(prepared.account, prepared.chainId);
}

function assertExecutionReference(
  prepared: PreparedBatch,
  group: BatchGroup,
  execution: BatchExecution
) {
  const reference = execution.reference;
  if (!reference) return;
  if (
    reference.chainId !== prepared.chainId ||
    reference.account.toLowerCase() !== prepared.account.toLowerCase()
  )
    throw new Error("batch-reference-scope-mismatch");
  if (group.reference && batchReferenceKey(reference) !== batchReferenceKey(group.reference))
    throw new Error("batch-reference-mismatch");
}

/** The same transaction reported two ways is unknown, whichever report came last. */
function receiptsContradict(receipts: readonly BatchReceipt[]): boolean {
  const seen = new Map<string, BatchReceipt["status"]>();
  return receipts.some((receipt) => {
    const hash = receipt.transactionHash.toLowerCase();
    const earlier = seen.get(hash);
    seen.set(hash, receipt.status);
    return earlier !== undefined && earlier !== receipt.status;
  });
}

async function settle(
  input: RecoveryInput,
  prepared: PreparedBatch,
  group: BatchGroup,
  execution: BatchExecution
): Promise<BatchGroup> {
  assertExecutionReference(prepared, group, execution);
  const next: BatchGroup = {
    ...group,
    status: execution.status,
    reference: execution.reference ?? group.reference,
    receipts: mergeReceipts(group.receipts, execution.receipts),
  };
  if (receiptsContradict(next.receipts)) return { ...next, status: "unresolved" };
  if (execution.status !== "confirmed")
    return (group.confirmedItemIds?.length || group.executionConfirmed) &&
      execution.status === "reverted"
      ? { ...next, status: "unresolved" }
      : next;
  if (
    !execution.receipts.length ||
    execution.receipts.some((receipt) => receipt.status !== "success")
  )
    return { ...next, status: "unresolved" };
  const verified = new Set(
    await input.verify({
      account: prepared.account,
      chainId: prepared.chainId,
      itemIds: group.itemIds,
      receipts: execution.receipts,
    })
  );
  if ([...verified].some((id) => !group.itemIds.includes(id)))
    throw new Error("batch-verification-mismatch");
  const confirmedItemIds = [...new Set([...(group.confirmedItemIds ?? []), ...verified])];
  return {
    ...next,
    confirmedItemIds,
    status: group.itemIds.every((id) => confirmedItemIds.includes(id)) ? "confirmed" : "unresolved",
  };
}

/** Submit the reviewed transport only. A previously uncertain operation always takes the read path. */
export async function executeBatchOperation(input: ExecutionInput): Promise<BatchRecord> {
  const { journal, sender } = input;
  const prepared = structuredClone(input.prepared);
  await owned(sender, prepared);
  const record = await journal.prepare(prepared);
  if (record.status === "confirmed") return record;
  if (waiting.has(record.status))
    return reconcileBatchOperation({
      ...input,
      operationId: record.id,
      account: prepared.account,
      chainId: prepared.chainId,
    });
  // A definitely ended attempt remains immutable; an explicit retry gets a new operation ID.
  if (["declined", "reverted", "released"].includes(record.status)) return record;
  if (!prepared.budget) throw new Error("batch-budget-required");
  if (!sender.preflightBatch) throw new Error("batch-preflight-unavailable");
  if (prepared.mode === "atomic") {
    const capability = await sender.getBatchCapability?.(prepared);
    if (
      !sender.submitAtomicBatch ||
      capability?.atomic !== "supported" ||
      capability.chainId !== prepared.chainId ||
      capability.account.toLowerCase() !== prepared.account.toLowerCase()
    )
      throw new Error("batch-atomic-unavailable");
  }
  return withBatchProgress(input.journal, record, false, async (save, current) => {
    for (const group of current().groups) {
      if (group.status === "confirmed") continue;
      await input.preflight(structuredClone(prepared), [...group.itemIds]);
      await owned(sender, prepared);
      const selected = prepared.items.filter((item) => group.itemIds.includes(item.id));
      const calls = (prepared.mode === "single-call" ? selected.slice(0, 1) : selected).map(
        ({ call }) => ({ ...call, value: BigInt(call.value) })
      );
      const quote = await sender.preflightBatch!(calls, structuredClone(prepared.budget!));
      assertBatchQuote(prepared.budget!, quote);
      await owned(sender, prepared);
      let next: BatchGroup = { ...group, quote, status: "awaiting-approval" };
      await save(next);
      const referenceKnown = async (reference: BatchReference, accepted: boolean) => {
        if (
          reference.chainId !== prepared.chainId ||
          reference.account.toLowerCase() !== prepared.account.toLowerCase()
        )
          throw new Error("batch-reference-scope-mismatch");
        next = {
          ...next,
          reference,
          ...(accepted ? { status: "submitted", accepted: true } : {}),
        };
        // Once a send is accepted its identity is saved, even if this tab has lost its claim.
        if (accepted) await journal.recordSubmission(prepared.id, next.itemIds, reference);
        await save(next);
      };
      const scoped = (reference: BroadcastReference): BatchReference => {
        const scope = { account: prepared.account, chainId: prepared.chainId };
        return reference.kind === "transaction" && !isCanonicalTransactionHash(reference.hash)
          ? { ...scope, kind: "wallet-transaction", id: reference.hash }
          : { ...reference, ...scope };
      };
      try {
        const options = {
          batchBudget: structuredClone(prepared.budget!),
          assertOwnership: async () => {
            await owned(sender, prepared);
          },
          onBeforeBroadcast: async (
            reference?: Parameters<NonNullable<TransactionSender["reconcileBroadcast"]>>[0]
          ) => {
            await owned(sender, prepared);
            if (reference)
              await referenceKnown(
                { ...reference, account: prepared.account, chainId: prepared.chainId },
                false
              );
            // Reopening after a crash relies on a UserOperation's reference being saved by now.
            else if (quote.authority === "user-operation")
              throw new Error("batch-reference-required");
            else await save(next);
          },
          onBroadcastReference: async (
            reference: Parameters<NonNullable<TransactionSender["reconcileBroadcast"]>>[0]
          ) => referenceKnown(scoped(reference), true),
          onBatchReference: (reference: BatchReference) => referenceKnown(reference, true),
        };
        let execution: BatchExecution;
        if (prepared.mode === "atomic") execution = await sender.submitAtomicBatch!(calls, options);
        else {
          const result = await sender.sendContractCall(calls[0], options);
          const reference = scoped(
            result.broadcastReference ?? { kind: "transaction", hash: result.hash }
          );
          execution = {
            status: result.confirmation === "pending" ? "unresolved" : "confirmed",
            reference,
            receipts:
              result.confirmation === "pending"
                ? []
                : [{ transactionHash: result.hash, status: "success" }],
            sponsored: result.sponsored,
          };
        }
        assertExecutionReference(prepared, next, execution);
        // Receipt persistence precedes domain reads, so an unavailable indexer never loses execution.
        next = {
          ...next,
          reference: execution.reference ?? next.reference,
          receipts: [...execution.receipts],
          status: execution.status === "reverted" ? "reverted" : "submitted",
          ...(execution.status === "confirmed" ? { executionConfirmed: true } : {}),
        };
        await save(next);
        next = await settle(input, prepared, next, execution);
        await save(next);
      } catch (error) {
        if (error instanceof BatchConfirmationPendingError)
          next = {
            ...next,
            reference: error.execution.reference ?? next.reference,
            receipts: [...error.execution.receipts],
          };
        const notSubmitted = error instanceof BatchNotSubmittedError;
        const declined =
          (!next.reference || notSubmitted) && classifyTxError(error).kind === "cancelled";
        next = {
          ...next,
          ...(notSubmitted ? { reference: undefined, receipts: [] } : {}),
          status: declined ? "declined" : notSubmitted ? "prepared" : "unresolved",
        };
        await save(next).catch(() => undefined);
        // Proven never sent: the caller gets the reason, and its items stay free to send.
        if (notSubmitted && !declined) throw error;
        return { ...current(), status: next.status };
      }
      if (next.status !== "confirmed") return current();
    }
    return current();
  });
}

/** Reconcile saved submission identities only; lease expiration never enters a send path. */
export async function reconcileBatchOperation(
  input: RecoveryInput & { operationId: string; account: Address; chainId: number }
): Promise<BatchRecord> {
  const record = await input.journal.get(input.operationId);
  if (!record) throw new Error("batch-not-found");
  if (
    record.prepared.account.toLowerCase() !== input.account.toLowerCase() ||
    record.prepared.chainId !== input.chainId
  )
    throw new Error("batch-scope-mismatch");
  await owned(input.sender, record.prepared);
  if (!waiting.has(record.status)) return record;
  return withBatchProgress(input.journal, record, true, async (save, current) => {
    for (const group of current().groups) {
      if (!waiting.has(group.status)) continue;
      // A UserOperation's reference is saved before it can be sent, so none means it was not sent.
      // A wallet is different: a prompt left open can still be approved after this tab has closed.
      if (!group.reference && group.quote?.authority === "user-operation") {
        await save({ ...group, status: "prepared", quote: undefined });
        break;
      }
      let next = { ...group, status: "unresolved" as const } as BatchGroup;
      try {
        if (group.reference) {
          const execution = await input.sender.reconcileBatch?.(group.reference);
          if (execution) {
            assertExecutionReference(record.prepared, next, execution);
            next = {
              ...next,
              receipts: mergeReceipts(next.receipts, execution.receipts),
              ...(execution.status === "confirmed" ? { executionConfirmed: true } : {}),
            };
            await save(next);
            // Execution proven once stays proven when a later wallet read has expired or sees less.
            const proven = next.executionConfirmed === true && execution.status === "unresolved";
            next = await settle(
              input,
              record.prepared,
              next,
              proven ? { ...execution, status: "confirmed", receipts: next.receipts } : execution
            );
          }
        }
      } catch {
        /* An unavailable read leaves the original submission held. */
      }
      await save(next);
      if (next.status !== "confirmed") break;
    }
    return current();
  });
}

/**
 * End a hold at a person's request, after they have seen fresh domain state. The read comes first,
 * so a submission that landed is confirmed instead. This is the only exit from an unknown outcome,
 * and it accepts that such a send could still land; the saved evidence stays on the record.
 */
export async function releaseBatchOperation(
  input: RecoveryInput & { operationId: string; account: Address; chainId: number }
): Promise<BatchRecord> {
  const record = await reconcileBatchOperation(input);
  if (!waiting.has(record.status)) return record;
  const identity = (group: BatchGroup) =>
    `${group.accepted ? "accepted" : "candidate"}:${group.reference ? batchReferenceKey(group.reference) : ""}`;
  return withBatchProgress(input.journal, record, true, async (save, current) => {
    // A send accepted after that read is news this person has not seen, so the hold stays.
    if (current().groups.some((group, index) => identity(group) !== identity(record.groups[index])))
      return current();
    for (const group of current().groups)
      if (waiting.has(group.status)) await save({ ...group, status: "released" });
    return current();
  });
}
