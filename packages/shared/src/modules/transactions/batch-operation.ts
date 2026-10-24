import type { Address } from "../../types/domain";
import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import {
  BatchConfirmationPendingError,
  BatchNotSubmittedError,
  type BatchExecution,
  type BatchGroup,
  type BatchRecord,
  type BatchReference,
  type PreparedBatch,
  type VerifyBatchItems,
} from "./batch-types";
import { assertBatchQuote } from "./batch-budget";
import type { BatchJournal } from "./batch-journal";
import { withBatchProgress } from "./batch-progress";
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
const waiting = new Set(["awaiting-approval", "submitted", "unresolved"]);

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
  const key = (ref: BatchReference) =>
    `${ref.kind}:${"id" in ref ? ref.id : ref.hash.toLowerCase()}`;
  if (group.reference && key(reference) !== key(group.reference))
    throw new Error("batch-reference-mismatch");
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
    receipts: [...execution.receipts],
  };
  if (execution.status !== "confirmed")
    return group.confirmedItemIds?.length && execution.status === "reverted"
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
  if (["declined", "reverted"].includes(record.status)) return record;
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
      const referenceKnown = async (reference: BatchReference) => {
        if (
          reference.chainId !== prepared.chainId ||
          reference.account.toLowerCase() !== prepared.account.toLowerCase()
        )
          throw new Error("batch-reference-scope-mismatch");
        next = { ...next, status: "submitted", reference };
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
              await referenceKnown({
                ...reference,
                account: prepared.account,
                chainId: prepared.chainId,
              });
            else await save(next);
          },
          onBroadcastReference: async (
            reference: Parameters<NonNullable<TransactionSender["reconcileBroadcast"]>>[0]
          ) => referenceKnown(scoped(reference)),
          onBatchReference: referenceKnown,
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
  if (["confirmed", "prepared", "declined", "reverted"].includes(record.status)) return record;
  return withBatchProgress(input.journal, record, true, async (save, current) => {
    for (const group of current().groups) {
      if (!waiting.has(group.status)) continue;
      let next = { ...group, status: "unresolved" as const } as BatchGroup;
      try {
        if (group.reference) {
          const execution = await input.sender.reconcileBatch?.(group.reference);
          if (execution) {
            assertExecutionReference(record.prepared, next, execution);
            next = { ...next, receipts: [...execution.receipts] };
            await save(next);
            next = await settle(input, record.prepared, next, execution);
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
