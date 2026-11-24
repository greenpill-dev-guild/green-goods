import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Interface, type JsonRpcProvider } from "ethers";
import type { SourceExecutionContext } from "./source-upgrade-execution-types";
import { createSourceExecutionStore, SOURCE_EXECUTION_FILES } from "./source-upgrade-execution-store";
import { createSourceUpgradeReadback } from "./source-upgrade-readback";
import { releaseJsonPath } from "./release-inputs";
import { writeReleaseJsonAtomic } from "./release-artifacts";
import {
  assertSourceExecutionClaim,
  assertSourceExecutionOwnerDead,
  claimSourceExecutionFile,
  readSourceExecutionFile,
  releaseSourceExecutionClaim,
} from "./source-upgrade-execution-claim";
import {
  assertSourceBatchOuter,
  buildSourceSafeBatch,
  sourceBatchBuilderFile,
  SOURCE_MULTISEND,
} from "./source-upgrade-batch";
import {
  assertSourceBatchState,
  batchCheck,
  batchSame,
  sourceBatchCostLimit,
  validateSourceBatchRecord,
  verifySourceBatchCreatePrefix,
  verifySourceBatchReceipt,
  type SourceBatchAttempt,
  type SourceBatchRecord,
} from "./source-upgrade-batch-verification";
import { voucherDigest } from "./voucher-release";

type Input = {
  options: Record<string, string | boolean | undefined>;
  context: SourceExecutionContext;
  directory: string;
  provider: JsonRpcProvider;
  abis: Parameters<typeof createSourceUpgradeReadback>[0]["abis"];
  revision: string;
  regenerateBindings: Parameters<typeof createSourceUpgradeReadback>[0]["regenerateBindings"];
};
type Journal = { recordHash: string; attempts: Record<string, SourceBatchAttempt>; completed?: SourceBatchAttempt };
const HASH = new Interface([
  "function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)",
]);
export async function runSourceBatchOperator(input: Input) {
  const { context: c, directory, provider, options: o } = input;
  const read = (file: string) => JSON.parse(fs.readFileSync(releaseJsonPath(directory, file), "utf8"));
  const required = (key: string) => {
    batchCheck(typeof o[key] === "string" && o[key], `missing --${key}`);
    return o[key] as string;
  };
  const createStore = createSourceExecutionStore({ directory, context: c });
  // Neither an active nor an ambiguous old direct/CREATE operation may be superseded.
  for (const file of [SOURCE_EXECUTION_FILES.lock, SOURCE_EXECUTION_FILES.recoveryLock])
    batchCheck(!fs.existsSync(path.join(directory, file)), "resolve the existing CREATE/direct execution lock first");
  const creates = createStore.readJournal();
  batchCheck(
    creates.completed.length === c.plan.deployments.length && !creates.pending,
    "all 23 CREATE checkpoints required before final batch release/adoption",
  );
  const port = createSourceUpgradeReadback({ ...input, journal: () => creates });
  const head = await provider.getBlock("latest");
  batchCheck(head?.hash, "canonical current block");
  await port.revalidateBindings();
  const base = path.join(directory, `${c.plan.releaseId}.safe-batch`);
  const journalPath = path.join(directory, "42161-source-safe-batch-execution.json");
  const lockPath = path.join(directory, "42161-source-safe-batch-execution.lock.json");
  if (o.mode === "export-safe-batch") {
    batchCheck(
      !fs.existsSync(journalPath) && !fs.existsSync(lockPath),
      "batch already has an adoption history; retain its existing review record",
    );
    const state = assertSourceBatchState(c, port, head.number, c.envelope.baseline.safe.nonce, false);
    await verifySourceBatchCreatePrefix(c, creates, port, state);
    const safe = await port.getSafeState(head.number),
      batch = buildSourceSafeBatch(c.plan, safe.nonce);
    const rehearsal = read(required("batch-rehearsal"));
    for (const [actual, expected, label] of [
      [rehearsal.planHash, voucherDigest(c.plan), "atomic rehearsal plan"],
      [rehearsal.runtimeBindingHash, c.runtime.bindingHash, "atomic rehearsal runtime"],
      [rehearsal.toolingRevision, input.revision, "atomic rehearsal tooling"],
      [rehearsal.safeTransactionHash, batch.safeTransactionHash, "atomic rehearsal hash/nonce"],
      [rehearsal.multiSend, SOURCE_MULTISEND, "atomic rehearsal MultiSend"],
    ])
      batchSame(actual, expected, String(label));
    batchCheck(
      rehearsal.atomicFailureRollback === true &&
        rehearsal.retrySucceeded === true &&
        rehearsal.safeNonceAfter === safe.nonce + 1 &&
        rehearsal.liveBroadcast === false,
      "exact atomic failure/retry rehearsal required",
    );
    const m = batch.message;
    const data = HASH.encodeFunctionData("getTransactionHash", [
      m.to,
      m.value,
      m.data,
      m.operation,
      m.safeTxGas,
      m.baseGas,
      m.gasPrice,
      m.gasToken,
      m.refundReceiver,
      m.nonce,
    ]);
    batchSame(
      String(
        HASH.decodeFunctionResult(
          "getTransactionHash",
          await provider.call({ to: c.manifest.authority.address, data, blockTag: head.number }),
        )[0],
      ).toLowerCase(),
      batch.safeTransactionHash.toLowerCase(),
      "canonical Safe hash",
    );
    const builder = sourceBatchBuilderFile(c.plan, true);
    const record: SourceBatchRecord = {
      schemaVersion: 1,
      kind: "ATOMIC_PAUSED_SOURCE_SAFE_BATCH",
      toolingRevision: input.revision,
      planHash: voucherDigest(c.plan),
      envelopeHash: voucherDigest(c.envelope),
      createPrefixHash: voucherDigest(creates.completed),
      runtimeBindingHash: c.runtime.bindingHash,
      observation: { blockNumber: head.number, blockHash: head.hash },
      atomicRehearsalHash: voucherDigest(rehearsal),
      externalCostLimitWei: String(sourceBatchCostLimit(c)),
      batch,
      builder,
    };
    validateSourceBatchRecord(c, creates, record, input.revision);
    await port.revalidateBindings();
    batchSame((await provider.getBlock(head.number))?.hash, head.hash, "export block changed");
    const output = releaseJsonPath(directory, typeof o.output === "string" ? o.output : `${base}.json`);
    batchCheck(output === `${base}.json`, "use the owned final Safe batch output path");
    writeReleaseJsonAtomic(`${base}.review.json`, record);
    writeReleaseJsonAtomic(output, builder);
    return {
      state: "safe-transaction-builder-batch-ready",
      output,
      review: `${base}.review.json`,
      safeTransactionHash: batch.safeTransactionHash,
      safeNonce: safe.nonce,
      calls: 4,
      maximumExternalCostWei: record.externalCostLimitWei,
      liveBroadcast: false,
    };
  }
  const record = read(required("batch")) as SourceBatchRecord;
  validateSourceBatchRecord(c, creates, record, input.revision);
  batchSame(
    (await provider.getBlock(record.observation.blockNumber))?.hash,
    record.observation.blockHash,
    "export observation reorg",
  );
  const identity = { recordHash: voucherDigest(record) };
  const metadata = { ...identity, pid: process.pid, token: randomUUID() };
  if (fs.existsSync(lockPath) && o["recover-lock"]) {
    const previous = readSourceExecutionFile(lockPath),
      value = JSON.parse(previous.bytes);
    batchSame(value.recordHash, identity.recordHash, "recovery record binding");
    assertSourceExecutionOwnerDead(value.pid);
    releaseSourceExecutionClaim(previous);
  }
  const claim = claimSourceExecutionFile(lockPath, metadata);
  try {
    let journal: Journal = fs.existsSync(journalPath)
      ? JSON.parse(readSourceExecutionFile(journalPath).bytes)
      : { ...identity, attempts: {} };
    batchSame(journal.recordHash, identity.recordHash, "batch journal binding");
    batchCheck(
      journal.attempts && typeof journal.attempts === "object" && !Array.isArray(journal.attempts),
      "batch paid-history shape",
    );
    for (const [hash, attempt] of Object.entries(journal.attempts)) {
      batchCheck(
        /^0x[\da-f]{64}$/i.test(hash) &&
          attempt.transactionHash === hash &&
          /^(0|[1-9]\d*)$/.test(attempt.actualCostWei) &&
          attempt.actualCostWei === String(BigInt(attempt.gasUsed) * BigInt(attempt.effectiveGasPrice)),
        "stored paid attempt",
      );
      const receipt = await port.getReceipt(hash);
      const transaction = await port.getTransaction(hash);
      batchCheck(
        transaction &&
          transaction.chainId === 42161n &&
          transaction.from === attempt.from &&
          transaction.nonce === attempt.outerNonce &&
          transaction.to?.toLowerCase() === c.manifest.authority.address.toLowerCase() &&
          transaction.value === 0n,
        "stored external executor",
      );
      assertSourceBatchOuter(transaction.data, record.batch);
      batchCheck(
        receipt &&
          receipt.blockHash === attempt.blockHash &&
          receipt.blockNumber === attempt.blockNumber &&
          receipt.status === attempt.status &&
          receipt.gasUsed === BigInt(attempt.gasUsed) &&
          receipt.gasPrice === BigInt(attempt.effectiveGasPrice),
        "canonical paid history",
      );
      batchSame((await port.getBlock(receipt.blockNumber)).hash, receipt.blockHash, "paid-history reorg");
    }
    const requestedHash = required("receipt").toLowerCase();
    batchCheck(
      !journal.completed || journal.completed.transactionHash === requestedHash,
      "batch already completed under another receipt",
    );
    let storedHash = voucherDigest(journal);
    const save = () => {
      assertSourceExecutionClaim(claim);
      if (fs.existsSync(journalPath))
        batchSame(
          voucherDigest(JSON.parse(readSourceExecutionFile(journalPath).bytes)),
          storedHash,
          "journal changed during adoption",
        );
      writeReleaseJsonAtomic(journalPath, journal, () => assertSourceExecutionClaim(claim));
      storedHash = voucherDigest(journal);
    };
    const charged = async (attempt: SourceBatchAttempt) => {
      const previous = journal.attempts[attempt.transactionHash];
      if (previous) batchSame(previous, attempt, "idempotent receipt charge");
      else {
        journal = { ...journal, attempts: { ...journal.attempts, [attempt.transactionHash]: attempt } };
        save();
      }
      const external = Object.values(journal.attempts).reduce((n, a) => n + BigInt(a.actualCostWei), 0n);
      batchCheck(
        external <= BigInt(record.externalCostLimitWei),
        "cumulative external batch gas exceeds the original four-call reservation",
      );
      const createSpent = Object.values(creates.attempts).reduce(
        (n, a) => n + BigInt(a.actualCostWei),
        BigInt(c.envelope.hatsSpentWei),
      );
      batchCheck(
        createSpent + external + BigInt(c.envelope.otherArbitrumReservedWei) <= BigInt(c.envelope.gasBudgetWei),
        "shared Arbitrum gas budget exceeded",
      );
    };
    const already = Boolean(journal.completed);
    const evidence = await verifySourceBatchReceipt(c, record, requestedHash, port, charged);
    const latest = await provider.getBlock("latest");
    batchCheck(latest?.hash, "canonical final block");
    const state = assertSourceBatchState(c, port, latest.number, record.batch.message.nonce + 1, true);
    await verifySourceBatchCreatePrefix(c, creates, port, state);
    await port.revalidateBindings();
    batchSame((await provider.getBlock(latest.number))?.hash, latest.hash, "final-state reorg");
    if (journal.completed) batchSame(journal.completed, evidence, "completed receipt unchanged");
    else {
      journal = { ...journal, completed: evidence };
      save();
    }
    return {
      state: already ? "atomic-batch-already-verified" : "atomic-batch-verified",
      ...evidence,
      safeTransactionHash: record.batch.safeTransactionHash,
      safeNonceAfter: record.batch.message.nonce + 1,
      externalPayer: evidence.from,
      safePaymentWei: "0",
      paused: true,
      liveBroadcast: false,
    };
  } finally {
    releaseSourceExecutionClaim(claim);
  }
}
