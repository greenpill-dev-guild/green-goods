import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { releaseJsonPath } from "./release-inputs";
import { writeReleaseJsonAtomic } from "./release-artifacts";
import { voucherDigest } from "./voucher-release";
import {
  runSourceExecutionBoundary,
  sourceBoundaryIntentHash,
  validateSourceExecutionEnvelope,
} from "./source-upgrade-execution";
import type {
  SourceBoundaryInput,
  SourceExecutionContext,
  SourceExecutionJournal,
  SourcePaidAttempt,
} from "./source-upgrade-execution-types";

import {
  assertSourceExecutionPath,
  readSourceExecutionFile,
  claimSourceExecutionFile,
  assertSourceExecutionClaim,
  releaseSourceExecutionClaim,
  assertSourceExecutionOwnerDead,
  type SourceExecutionClaim,
} from "./source-upgrade-execution-claim";

export const SOURCE_EXECUTION_FILES = Object.freeze({
  journal: "42161-source-upgrade-execution.json",
  lock: "42161-source-upgrade-execution.lock.json",
  recoveryLock: "42161-source-upgrade-execution.recovery.lock.json",
});

type ClaimedBoundary = SourceExecutionClaim & { uncertain?: true };
type Boundary = Omit<SourceBoundaryInput, keyof SourceExecutionContext | "journal" | "writeJournal">;
type Recovery = Omit<Boundary, "operatorSubmitCreate" | "safeSubmission" | "receiptHash"> & {
  receiptHash: string;
  operatorSubmitCreate?: never;
  safeSubmission?: never;
};
const isHash = (value: unknown): value is string => typeof value === "string" && /^0x[\da-f]{64}$/i.test(value);
const isInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const isDecimal = (value: unknown) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Source execution store ${message}`);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  check(
    Object.keys(value).every((key) => allowed.includes(key)),
    "unexpected stored fields",
  );
}
function equal(actual: unknown, expected: unknown, message: string) {
  check(voucherDigest(actual) === voucherDigest(expected), message);
}
function paid(value: unknown): asserts value is SourcePaidAttempt {
  check(record(value), "paid attempt shape");
  keys(value, ["transactionHash", "blockNumber", "blockHash", "actualCostWei", "status"]);
  check(
    isHash(value.transactionHash) &&
      isHash(value.blockHash) &&
      isInteger(value.blockNumber) &&
      isDecimal(value.actualCostWei) &&
      (value.status === 0 || value.status === 1),
    "paid attempt fields",
  );
}
function validateJournal(
  value: unknown,
  identity: { planHash: string; envelopeHash: string },
  context: SourceExecutionContext,
): asserts value is SourceExecutionJournal {
  check(record(value), "journal shape");
  keys(value, ["planHash", "envelopeHash", "completed", "attempts", "pausedSnapshots", "pending"]);
  equal([value.planHash, value.envelopeHash], [identity.planHash, identity.envelopeHash], "journal binding");
  check(
    Array.isArray(value.completed) && record(value.attempts) && record(value.pausedSnapshots),
    "journal collections",
  );
  check(value.completed.length <= context.envelope.boundaries.length, "completed prefix range");
  for (const [key, attempt] of Object.entries(value.attempts)) {
    paid(attempt);
    check(key === attempt.transactionHash.toLowerCase(), "paid attempt key");
  }
  for (const [index, evidence] of value.completed.entries()) {
    check(record(evidence), "completed evidence shape");
    keys(evidence, [
      "step",
      "transactionHash",
      "blockNumber",
      "blockHash",
      "actualCostWei",
      "runtimeHash",
      "safeTransactionHash",
    ]);
    check(
      evidence.step === index + 1 &&
        isHash(evidence.transactionHash) &&
        isHash(evidence.blockHash) &&
        isInteger(evidence.blockNumber) &&
        isDecimal(evidence.actualCostWei),
      "completed evidence fields",
    );
    const attempt = value.attempts[evidence.transactionHash.toLowerCase()];
    check(record(attempt) && attempt.status === 1, "completed paid attempt missing");
    equal(
      [evidence.transactionHash, evidence.blockNumber, evidence.blockHash, evidence.actualCostWei],
      [attempt.transactionHash, attempt.blockNumber, attempt.blockHash, attempt.actualCostWei],
      "completed paid evidence",
    );
    const kind = context.envelope.boundaries[index].kind;
    check(
      kind === "create"
        ? isHash(evidence.runtimeHash) && evidence.safeTransactionHash === undefined
        : isHash(evidence.safeTransactionHash) && evidence.runtimeHash === undefined,
      "completed evidence kind",
    );
  }
  for (const [target, snapshot] of Object.entries(value.pausedSnapshots)) {
    check(["pooling", "settlement"].includes(target) && record(snapshot), "pause snapshot shape");
    keys(snapshot, ["blockNumber", "blockHash", "preservedHash"]);
    check(
      isInteger(snapshot.blockNumber) &&
        isHash(snapshot.blockHash) &&
        typeof snapshot.preservedHash === "string" &&
        /^[\da-f]{64}$/.test(snapshot.preservedHash),
      "pause snapshot fields",
    );
  }
  if (value.pending !== undefined) {
    const pending = value.pending;
    check(record(pending), "pending intent shape");
    keys(pending, ["step", "from", "nonce", "dataHash", "gasLimit", "maxFeeWei", "transactionHash"]);
    check(isInteger(pending.step) && pending.step === value.completed.length + 1, "pending prefix");
    const boundary = context.envelope.boundaries[pending.step - 1];
    check(boundary, "pending boundary");
    equal(
      [pending.from, pending.nonce, pending.gasLimit, pending.maxFeeWei, pending.dataHash],
      [
        boundary.from,
        boundary.kind === "create" ? boundary.nonce : boundary.outerNonce,
        boundary.gasLimit,
        boundary.maxFeeWei,
        sourceBoundaryIntentHash(context, pending.step),
      ],
      "pending intent binding",
    );
    check(pending.transactionHash === undefined || isHash(pending.transactionHash), "pending transaction hash");
  }
}
function preserve(previous: SourceExecutionJournal, next: SourceExecutionJournal) {
  check(
    next.completed.length >= previous.completed.length && next.completed.length <= previous.completed.length + 1,
    "journal prefix reset",
  );
  equal(next.completed.slice(0, previous.completed.length), previous.completed, "completed history changed");
  for (const [key, value] of Object.entries(previous.attempts))
    equal(next.attempts[key], value, "paid history changed");
  for (const [key, value] of Object.entries(previous.pausedSnapshots))
    equal(next.pausedSnapshots[key as keyof typeof previous.pausedSnapshots], value, "pause history changed");
  if (previous.pending) {
    if (next.pending) {
      const { transactionHash, ...intent } = previous.pending;
      const { transactionHash: nextHash, ...nextIntent } = next.pending;
      equal(nextIntent, intent, "pending intent changed");
      if (transactionHash) equal(nextHash, transactionHash, "pending receipt changed");
    } else {
      const completed = next.completed[previous.pending.step - 1];
      check(completed?.step === previous.pending.step, "pending intent cleared without adoption");
      if (previous.pending.transactionHash)
        equal(completed.transactionHash, previous.pending.transactionHash, "pending adoption changed");
    }
  }
}
export function createSourceExecutionStore({
  directory,
  context,
}: {
  directory: string;
  context: SourceExecutionContext;
}) {
  validateSourceExecutionEnvelope(context);
  const root = path.resolve(directory);
  const paths = Object.freeze({
    journal: releaseJsonPath(root, path.join(root, SOURCE_EXECUTION_FILES.journal)),
    lock: releaseJsonPath(root, path.join(root, SOURCE_EXECUTION_FILES.lock)),
    recoveryLock: releaseJsonPath(root, path.join(root, SOURCE_EXECUTION_FILES.recoveryLock)),
  });
  const identity = { planHash: voucherDigest(context.plan), envelopeHash: voucherDigest(context.envelope) };
  const assertPaths = () => {
    for (const file of Object.values(paths)) assertSourceExecutionPath(file);
  };
  const empty = (): SourceExecutionJournal => ({ ...identity, completed: [], attempts: {}, pausedSnapshots: {} });
  const readJournal = () => {
    assertPaths();
    let value: unknown;
    try {
      value = JSON.parse(readSourceExecutionFile(paths.journal).bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
      throw error;
    }
    validateJournal(value, identity, context);
    return value;
  };
  const metadata = (boundary: Boundary, kind: "execute" | "recovery") => ({
    schemaVersion: 1,
    chainId: 42161,
    kind,
    token: randomUUID(),
    pid: process.pid,
    ...identity,
    journal: paths.journal,
    step: boundary.step,
    expectedNonce: boundary.expectedNonce,
  });
  const run = async (boundary: Boundary, owned: ClaimedBoundary, recoveryGuard?: SourceExecutionClaim) => {
    const journal = readJournal();
    let lastHash = voucherDigest(journal);
    const writeJournal = async (next: SourceExecutionJournal) => {
      assertPaths();
      assertSourceExecutionClaim(owned);
      if (recoveryGuard) assertSourceExecutionClaim(recoveryGuard);
      const previous = readJournal();
      equal(voucherDigest(previous), lastHash, "journal changed while claimed");
      validateJournal(next, identity, context);
      preserve(previous, next);
      if (next.pending || Object.keys(next.attempts).length > 0) owned.uncertain = true;
      writeReleaseJsonAtomic(paths.journal, next, () => {
        assertPaths();
        assertSourceExecutionClaim(owned);
        if (recoveryGuard) assertSourceExecutionClaim(recoveryGuard);
      });
      lastHash = voucherDigest(next);
    };
    if (!fs.existsSync(paths.journal)) await writeJournal(journal);
    const result = await runSourceExecutionBoundary({ ...context, ...boundary, journal, writeJournal });
    check(!readJournal().pending, "successful boundary still pending");
    return result;
  };
  return {
    paths,
    readJournal,
    async executeBoundary(boundary: Boundary) {
      const initial = readJournal();
      check(!fs.existsSync(paths.recoveryLock), "recovery guard requires explicit operator resolution");
      const owned: ClaimedBoundary = claimSourceExecutionFile(paths.lock, metadata(boundary, "execute"));
      try {
        check(!fs.existsSync(paths.recoveryLock), "recovery guard appeared during claim");
        const result = await run(boundary, owned);
        releaseSourceExecutionClaim(owned);
        return result;
      } catch (error) {
        // Read/cleanup uncertainty preserves the main claim for explicit adoption.
        try {
          const current = readJournal();
          if (
            !owned.uncertain &&
            !current.pending &&
            !Object.values(current.attempts).some((attempt) => attempt.status === 0) &&
            voucherDigest(current) === voucherDigest(initial)
          )
            releaseSourceExecutionClaim(owned);
        } catch {
          /* Keep the original claim when journal or ownership is uncertain. */
        }
        throw error;
      }
    },
    async recoverBoundary(boundary: Recovery) {
      check(
        !("operatorSubmitCreate" in boundary) && !("safeSubmission" in boundary),
        "recovery cannot accept a signer",
      );
      check(isHash(boundary.receiptHash), "recovery requires an exact receipt");
      readJournal();
      const original = readSourceExecutionFile(paths.lock),
        value: unknown = JSON.parse(original.bytes);
      check(record(value), "lock metadata shape");
      equal(value, { ...metadata(boundary, "execute"), pid: value.pid, token: value.token }, "lock identity binding");
      check(typeof value.token === "string" && value.token.length > 0, "lock token missing");
      assertSourceExecutionOwnerDead(value.pid);
      const owned: ClaimedBoundary = original;
      const guard = claimSourceExecutionFile(paths.recoveryLock, {
        ...metadata(boundary, "recovery"),
        originalToken: value.token,
      });
      try {
        assertSourceExecutionClaim(owned);
        assertSourceExecutionOwnerDead(value.pid);
        const result = await run(boundary, owned, guard);
        releaseSourceExecutionClaim(owned);
        return result;
      } finally {
        releaseSourceExecutionClaim(guard);
      }
    },
  };
}
