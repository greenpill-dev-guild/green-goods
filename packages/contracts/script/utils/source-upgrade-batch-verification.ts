import { keccak256 } from "ethers";
import { SOURCE_UPGRADE_TARGETS, type SourceTarget } from "./source-upgrade-release";
import type {
  SourceExecutionContext,
  SourceExecutionJournal,
  SourceExecutionReadPort,
} from "./source-upgrade-execution-types";
import { assertSourceSafeAuthority } from "./source-upgrade-safe-execution";
import { verifySourceBoundaryEvidence } from "./source-upgrade-execution";
import {
  assertSourceBatchOuter,
  assertSourceBatchSuccess,
  buildSourceSafeBatch,
  sourceBatchBuilderFile,
  SOURCE_MULTISEND,
  type SourceSafeBatch,
} from "./source-upgrade-batch";
import { voucherDigest } from "./voucher-release";

export interface SourceBatchRecord {
  schemaVersion: 1;
  kind: "ATOMIC_PAUSED_SOURCE_SAFE_BATCH";
  toolingRevision: string;
  planHash: string;
  envelopeHash: string;
  createPrefixHash: string;
  runtimeBindingHash: string;
  observation: { blockNumber: number; blockHash: string };
  atomicRehearsalHash: string;
  externalCostLimitWei: string;
  batch: SourceSafeBatch;
  builder: ReturnType<typeof sourceBatchBuilderFile>;
}
export interface SourceBatchAttempt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  outerNonce: number;
  gasUsed: string;
  effectiveGasPrice: string;
  actualCostWei: string;
  status: 0 | 1;
}
export function batchCheck(value: unknown, label: string): asserts value {
  if (!value) throw new Error(`Source batch verification ${label}`);
}
export function batchSame(actual: unknown, expected: unknown, label: string) {
  batchCheck(voucherDigest(actual) === voucherDigest(expected), label);
}
export function sourceBatchCostLimit(c: SourceExecutionContext) {
  return c.envelope.boundaries
    .slice(c.plan.deployments.length)
    .reduce((n, b) => n + BigInt(b.gasLimit) * BigInt(b.maxFeeWei), 0n);
}
export function validateSourceBatchRecord(
  c: SourceExecutionContext,
  j: SourceExecutionJournal,
  value: SourceBatchRecord,
  revision: string,
) {
  batchCheck(value.schemaVersion === 1 && value.kind === "ATOMIC_PAUSED_SOURCE_SAFE_BATCH", "record shape");
  batchSame(value.toolingRevision, revision, "reviewed tooling revision");
  batchSame(value.planHash, voucherDigest(c.plan), "plan binding");
  batchSame(value.envelopeHash, voucherDigest(c.envelope), "envelope binding");
  batchSame(value.createPrefixHash, voucherDigest(j.completed), "CREATE prefix binding");
  batchSame(value.runtimeBindingHash, c.runtime.bindingHash, "compiler runtime binding");
  batchSame(value.externalCostLimitWei, String(sourceBatchCostLimit(c)), "reserved batch budget");
  batchSame(value.batch, buildSourceSafeBatch(c.plan, value.batch.message.nonce), "exact atomic batch");
  batchCheck(value.batch.message.nonce === c.envelope.baseline.safe.nonce, "reviewed Safe nonce");
  batchSame(
    value.builder,
    sourceBatchBuilderFile(c.plan, true, value.builder.createdAt),
    "exact Transaction Builder file",
  );
}
type StateContext = Pick<SourceExecutionContext, "plan" | "manifest" | "runtime"> & {
  envelope: Pick<SourceExecutionContext["envelope"], "baseline" | "safePins">;
};
type StatePort = Pick<
  SourceExecutionReadPort,
  "getSafeState" | "getCode" | "getProxyState" | "verifyImplementationGetters" | "assertNewPeerPinsEmpty"
>;
export async function assertSourceBatchState(
  c: StateContext,
  port: StatePort,
  block: number,
  nonce: number,
  upgraded: boolean,
) {
  const safe = await port.getSafeState(block);
  assertSourceSafeAuthority(safe, c.manifest.authority, c.envelope.safePins);
  batchCheck(safe.nonce === nonce, "one atomic Safe nonce");
  batchSame(
    keccak256(await port.getCode(SOURCE_MULTISEND.address, block)),
    SOURCE_MULTISEND.runtimeHash,
    "canonical MultiSendCallOnly runtime",
  );
  for (const target of ["pooling", "settlement"] as SourceTarget[]) {
    const pin = c.manifest[target],
      baseline = c.envelope.baseline.sources[target];
    batchCheck(pin && baseline, "both reviewed modules required");
    const deployment = c.plan.deployments.find((d) => d.key === SOURCE_UPGRADE_TARGETS[target]);
    batchCheck(deployment, "planned implementation missing");
    const state = await port.getProxyState(target, block);
    batchSame(state.owner.toLowerCase(), baseline.owner.toLowerCase(), "unchanged module owner");
    batchSame(state.preserved, baseline.preserved, "preserved source state");
    batchCheck(state.paused === (upgraded || baseline.paused), "paused module state");
    const implementation = upgraded ? deployment.address : pin.implementation;
    batchSame(state.implementation.toLowerCase(), implementation.toLowerCase(), "planned implementation");
    const expectedHash = upgraded
      ? c.runtime.deployments.find((d) => d.key === deployment.key)!.runtimeHash
      : pin.implementationCodeHash;
    batchSame(keccak256(await port.getCode(implementation, block)), expectedHash, "implementation runtime");
    if (upgraded) {
      await port.verifyImplementationGetters(deployment, c.manifest, block);
      await port.assertNewPeerPinsEmpty(target, block);
    }
  }
}
export async function verifySourceBatchCreatePrefix(
  c: SourceExecutionContext,
  journal: SourceExecutionJournal,
  port: SourceExecutionReadPort,
  phaseChecked: Promise<void>,
) {
  batchCheck(
    journal.completed.length === c.plan.deployments.length && !journal.pending,
    "all CREATEs must be canonically adopted; no direct Safe calls or pending send",
  );
  await phaseChecked;
  // The atomic phase owns current Safe/module state; historical CREATE receipt/runtime checks stay unchanged.
  const createPort = { ...port, assertCurrentPrefixState: async () => phaseChecked };
  for (const evidence of journal.completed) {
    const checked = await verifySourceBoundaryEvidence({
      ...c,
      step: evidence.step,
      transactionHash: evidence.transactionHash,
      port: createPort,
      entirePrefixLength: journal.completed.length,
    });
    batchSame(checked, evidence, "canonical CREATE checkpoint");
  }
}
export async function verifySourceBatchReceipt(
  c: SourceExecutionContext,
  record: SourceBatchRecord,
  transactionHash: string,
  port: SourceExecutionReadPort,
  charge: (attempt: SourceBatchAttempt) => Promise<void>,
) {
  batchCheck(/^0x[\da-f]{64}$/i.test(transactionHash) && (await port.getChainId()) === 42161, "receipt hash/chain");
  const [tx, receipt] = await Promise.all([port.getTransaction(transactionHash), port.getReceipt(transactionHash)]);
  batchCheck(tx && receipt, "receipt unavailable; retry adoption with the same public hash");
  batchCheck(
    tx.chainId === 42161n && tx.value === 0n && tx.to?.toLowerCase() === c.manifest.authority.address.toLowerCase(),
    "outer chain/target/value",
  );
  batchSame(tx.hash.toLowerCase(), transactionHash.toLowerCase(), "transaction hash");
  batchSame(receipt.hash.toLowerCase(), transactionHash.toLowerCase(), "receipt hash");
  batchCheck(tx.blockNumber === receipt.blockNumber && tx.blockHash === receipt.blockHash, "receipt block");
  batchSame((await port.getBlock(receipt.blockNumber)).hash, receipt.blockHash, "canonical receipt");
  assertSourceBatchOuter(tx.data, record.batch);
  batchCheck(
    receipt.gasUsed > 0n &&
      receipt.gasUsed <= tx.gasLimit &&
      receipt.gasPrice >= 0n &&
      receipt.gasPrice <= tx.maxFeePerGas,
    "actual network fee bounds",
  );
  const attempt: SourceBatchAttempt = {
    transactionHash: transactionHash.toLowerCase(),
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    from: tx.from,
    outerNonce: tx.nonce,
    gasUsed: String(receipt.gasUsed),
    effectiveGasPrice: String(receipt.gasPrice),
    actualCostWei: String(receipt.gasUsed * receipt.gasPrice),
    status: receipt.status,
  };
  await charge(attempt);
  batchCheck(
    receipt.status === 1,
    "outer batch reverted; paid attempt recorded, atomic batch may be retried at the unchanged Safe nonce",
  );
  assertSourceBatchSuccess(receipt.logs, record.batch);
  batchCheck(receipt.blockNumber > 0, "parent block required");
  await assertSourceBatchState(c, port, receipt.blockNumber - 1, record.batch.message.nonce, false);
  await assertSourceBatchState(c, port, receipt.blockNumber, record.batch.message.nonce + 1, true);
  batchSame((await port.getBlock(receipt.blockNumber)).hash, receipt.blockHash, "receipt reorg during adoption");
  return attempt;
}
