import {
  SOURCE_SAFE_EXECUTION,
  assertSourceSafeAuthority,
  assertSourceSafeOuterCalldata,
  verifySourceSafeReceipt,
  sourceSafeTransactionHash,
  exportSourceSafeBoundary,
} from "./source-upgrade-safe-execution";
export { SOURCE_SAFE_EXECUTION, sourceSafeTransactionHash, exportSourceSafeBoundary };
import { getCreateAddress, keccak256 } from "ethers";
import { SOURCE_UPGRADE_TARGETS } from "./source-upgrade-release";
import { voucherDigest } from "./voucher-release";
import { assertSourceSignedSafeCalldata } from "./source-upgrade-safe-signing";
import type {
  SourceExecutionContext,
  SourceExecutionEnvelope,
  SourceExecutionJournal,
  SourceBoundaryInput,
  SourceBoundaryAdoption,
  SourceBoundaryEvidence,
} from "./source-upgrade-execution-types";

export const SOURCE_EXECUTION_POLICY = Object.freeze({
  chainId: 42161,
  maxFeeWei: 50_000_000n,
  gasBudgetWei: 5_000_000_000_000_000n,
  hatsSpentWei: 75_178_085_730_000n,
  ccipBudgetWei: 2_000_000_000_000_000n,
});
function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`Source execution ${label}`);
}
function same(actual: unknown, expected: unknown, label: string) {
  check(
    actual !== undefined && expected !== undefined && String(actual).toLowerCase() === String(expected).toLowerCase(),
    label,
  );
}
function integer(value: string, label: string) {
  check(/^(0|[1-9][0-9]*)$/.test(value), label);
  return BigInt(value);
}
export function validateSourceExecutionEnvelope(c: SourceExecutionContext): void {
  const { plan: p, manifest: m, envelope: e, rehearsal: r, runtime } = c;
  same(e.planHash, voucherDigest(p), "plan binding");
  same(e.manifestHash, p.manifestHash, "manifest binding");
  same(e.manifestHash, voucherDigest(m), "manifest bytes");
  same(e.sourceCommit, p.sourceCommit, "source binding");
  same(voucherDigest(e.artifactHashes), voucherDigest(p.artifactHashes), "artifact binding");
  same(e.runtimeBindingHash, runtime.bindingHash, "runtime binding");
  same(
    voucherDigest(e.compilerJobHashes),
    voucherDigest(Object.fromEntries(runtime.deployments.map((d) => [d.key, d.compilerJobHash]))),
    "compiler job binding",
  );
  same(e.rehearsalHash, voucherDigest(r), "rehearsal bytes");
  same(r.planHash, e.planHash, "rehearsal plan");
  same(r.sourceCommit, p.sourceCommit, "rehearsal source");
  same(r.manifestHash, p.manifestHash, "rehearsal manifest");
  same(r.runtimeBindingHash, runtime.bindingHash, "rehearsal runtime binding");
  check(p.chainId === SOURCE_EXECUTION_POLICY.chainId && e.chainId === p.chainId, "chain binding");
  for (const key of ["maxFeeWei", "hatsSpentWei", "gasBudgetWei", "ccipBudgetWei"] as const)
    same(e[key], String(SOURCE_EXECUTION_POLICY[key]), `fixed ${key}`);
  check(m.nonce !== null && m.deployer !== null && m.authority.nonce !== null, "missing concrete authority/nonce");
  check(
    p.deployments.length > 0 && p.deployments.length <= 23 && p.ownerCalls.length === (m.settlement ? 4 : 2),
    "selected target shape",
  );
  if (m.settlement) check(p.deployments.length === 23, "reviewed 23 CREATE shape");
  check(
    e.boundaries.length === p.deployments.length + p.ownerCalls.length &&
      runtime.deployments.length === p.deployments.length &&
      r.deployments.length === p.deployments.length,
    "boundary/runtime shape",
  );
  same(voucherDigest(e.baseline.observation), voucherDigest(m.observation), "baseline observation");
  assertSourceSafeAuthority(e.baseline.safe, m.authority, e.safePins);
  check(e.baseline.safe.nonce === m.authority.nonce, "baseline Safe nonce");
  for (const target of ["pooling", "settlement"] as const) {
    if (!m[target]) continue;
    const state = e.baseline.sources[target];
    check(state, "missing baseline source state");
    same(state.owner, m.authority.address, "baseline source owner");
    same(state.implementation, m[target].implementation, "baseline implementation");
    check(
      typeof state.paused === "boolean" && state.preserved && Object.keys(state.preserved).length > 0,
      "selected baseline getter outputs",
    );
  }
  for (const [i, b] of e.boundaries.entries()) {
    check(b.step === i + 1 && integer(b.gasLimit, "gas limit") > 0n, "boundary order/gas");
    same(b.maxFeeWei, e.maxFeeWei, "boundary fee cap");
    check(b.priorityFeeWei === "0", "priority fee");
    same(b.from, m.deployer, "approved deployer");
    if (i < p.deployments.length) {
      const d = p.deployments[i],
        exact = runtime.deployments[i],
        rehearsed = r.deployments[i];
      check(b.kind === "create" && b.nonce === d.nonce && d.nonce === m.nonce + i, "CREATE nonce");
      same(d.from, b.from, "CREATE sender");
      for (const key of ["key", "address"] as const) same(exact[key], d[key], `runtime ${key}`);
      for (const key of ["key", "address", "runtimeHash", "compilerJobHash"] as const)
        same(rehearsed[key], exact[key], `rehearsed ${key}`);
      same(b.runtimeHash, exact.runtimeHash, "exact runtime hash");
    } else {
      const call = p.ownerCalls[i - p.deployments.length];
      check(
        b.kind === "safe" && b.safeNonce === call.safeNonce && b.outerNonce === m.nonce + i,
        "Safe EOA/Safe nonce separation",
      );
      check(b.safeTxGas === "0" && b.baseGas === "0", "unreimbursed direct Safe recipe");
    }
  }
  const reserved = e.boundaries.reduce(
    (n, b) => n + integer(b.gasLimit, "gas limit") * SOURCE_EXECUTION_POLICY.maxFeeWei,
    0n,
  );
  check(
    SOURCE_EXECUTION_POLICY.hatsSpentWei + reserved + integer(e.otherArbitrumReservedWei, "other reservations") <=
      SOURCE_EXECUTION_POLICY.gasBudgetWei,
    "shared Arbitrum budget exceeded",
  );
}
export function sourceExecutionRemainingBudget(
  journal: SourceExecutionJournal,
  envelope: SourceExecutionEnvelope,
  afterStep: number,
) {
  check(Number.isSafeInteger(afterStep) && afterStep >= 0 && afterStep <= envelope.boundaries.length, "budget prefix");
  const spent = Object.entries(journal.attempts).reduce<bigint>((n, [key, a]) => {
    same(key, a.transactionHash, "paid attempt key");
    return n + integer(a.actualCostWei, "paid gas");
  }, SOURCE_EXECUTION_POLICY.hatsSpentWei);
  const remaining = envelope.boundaries
    .slice(afterStep)
    .reduce((n, b) => n + integer(b.gasLimit, "gas limit") * SOURCE_EXECUTION_POLICY.maxFeeWei, 0n);
  check(
    spent + remaining + integer(envelope.otherArbitrumReservedWei, "other reservations") <=
      SOURCE_EXECUTION_POLICY.gasBudgetWei,
    "remaining shared Arbitrum budget exceeded",
  );
  return { spentWei: String(spent), remainingMaximumWei: String(remaining) };
}
async function verifyBoundary(
  input: SourceBoundaryAdoption,
  entirePrefixLength: number,
): Promise<SourceBoundaryEvidence> {
  const { plan, manifest: m, envelope, step, transactionHash, port } = input;
  check((await port.getChainId()) === SOURCE_EXECUTION_POLICY.chainId, "RPC chain");
  const b = envelope.boundaries[step - 1];
  check(b?.step === step, "unknown boundary");
  check(
    Number.isSafeInteger(entirePrefixLength) &&
      entirePrefixLength >= step &&
      entirePrefixLength <= envelope.boundaries.length,
    "evidence prefix",
  );
  const [tx, r] = await Promise.all([port.getTransaction(transactionHash), port.getReceipt(transactionHash)]);
  check(tx && r, "receipt unavailable; reconcile only");
  same(tx.hash, transactionHash, "transaction hash");
  same(r.hash, transactionHash, "receipt hash");
  check(tx.chainId === BigInt(SOURCE_EXECUTION_POLICY.chainId), "transaction chain");
  check(tx.blockNumber === r.blockNumber, "receipt block");
  same(tx.blockHash, r.blockHash, "receipt block hash");
  same((await port.getBlock(r.blockNumber)).hash, r.blockHash, "noncanonical receipt");
  check(tx.value === 0n, "nonzero native value");
  same(tx.from, b.from, "outer sender");
  check(tx.nonce === (b.kind === "create" ? b.nonce : b.outerNonce), "outer nonce");
  check(
    tx.gasLimit === BigInt(b.gasLimit) &&
      tx.maxFeePerGas === SOURCE_EXECUTION_POLICY.maxFeeWei &&
      tx.maxPriorityFeePerGas === 0n,
    "outer gas/fee cap",
  );
  check(
    r.gasUsed >= 0n &&
      r.gasUsed <= tx.gasLimit &&
      r.gasPrice >= 0n &&
      r.gasPrice <= SOURCE_EXECUTION_POLICY.maxFeeWei &&
      [0, 1].includes(r.status),
    "receipt fee bounds",
  );
  const d = plan.deployments[step - 1],
    call = plan.ownerCalls[step - plan.deployments.length - 1];
  if (b.kind === "create") {
    check(tx.to === null, "CREATE target");
    same(tx.data, d.data, "CREATE calldata");
  } else {
    same(tx.to, m.authority.address, "Safe outer target");
    assertSourceSafeOuterCalldata(tx.data, call);
  }
  const evidence = {
    step,
    transactionHash,
    blockNumber: r.blockNumber,
    blockHash: r.blockHash,
    actualCostWei: String(r.gasUsed * r.gasPrice),
  };
  await input.recordMatchedAttempt({
    transactionHash,
    blockNumber: r.blockNumber,
    blockHash: r.blockHash,
    actualCostWei: evidence.actualCostWei,
    status: r.status,
  });
  check(r.status === 1, "matching transaction reverted; paid attempt remains charged");
  let result: SourceBoundaryEvidence;
  if (b.kind === "create") {
    same(r.contractAddress, getCreateAddress({ from: d.from, nonce: d.nonce }), "receipt CREATE address");
    same(r.contractAddress, d.address, "planned CREATE address");
    for (const block of [r.blockNumber, "latest"] as const)
      same(keccak256(await port.getCode(d.address, block)), b.runtimeHash, "exact runtime");
    if (d.kind === "implementation") await port.verifyImplementationGetters(d, m, r.blockNumber);
    result = { ...evidence, runtimeHash: b.runtimeHash };
  } else {
    const safeHash = await verifySourceSafeReceipt(input, r, entirePrefixLength);
    const state = await port.getProxyState(call.target, r.blockNumber);
    same(state.owner, m.authority.address, "original proxy owner");
    check(state.paused === true, "proxy remains paused");
    const implementation =
      call.action === "pause"
        ? m[call.target]!.implementation
        : plan.deployments.find((item) => item.key === SOURCE_UPGRADE_TARGETS[call.target])!.address;
    // A readonly replay may observe a later, already verified upgrade in the same block.
    if (entirePrefixLength === step) same(state.implementation, implementation, "proxy implementation boundary");
    if (call.action === "upgrade") {
      const snapshot = input.pausedSnapshots?.[call.target];
      check(snapshot, "pause snapshot required");
      same(voucherDigest(state.preserved), snapshot.preservedHash, "paused selected source state preservation");
      await port.assertNewPeerPinsEmpty(call.target, r.blockNumber);
    }
    result = { ...evidence, safeTransactionHash: safeHash };
  }
  await port.assertCurrentPrefixState(entirePrefixLength);
  same((await port.getBlock(r.blockNumber)).hash, r.blockHash, "canonical block changed during adoption");
  return result;
}
export function verifySourceExecutionBoundary(input: SourceBoundaryAdoption) {
  return verifyBoundary(input, input.step);
}
export function verifySourceBoundaryEvidence(
  input: Omit<SourceBoundaryAdoption, "recordMatchedAttempt"> & { entirePrefixLength?: number },
) {
  return verifyBoundary({ ...input, recordMatchedAttempt: async () => {} }, input.entirePrefixLength ?? input.step);
}
/** Pending Safe intents bind the EIP-712 operation, independent of which valid owner signatures encode it. */
export function sourceBoundaryIntentHash(context: SourceExecutionContext, step: number) {
  const b = context.envelope.boundaries[step - 1];
  return b.kind === "create"
    ? keccak256(context.plan.deployments[step - 1].data)
    : sourceSafeTransactionHash(
        context.plan.ownerCalls[step - context.plan.deployments.length - 1],
        b,
        context.manifest.authority.address,
      );
}
export async function runSourceExecutionBoundary(input: SourceBoundaryInput) {
  const { plan, manifest, envelope, step, expectedNonce, receiptHash, journal, port, writeJournal } = input;
  await port.revalidateBindings();
  validateSourceExecutionEnvelope(input);
  same(journal.planHash, voucherDigest(plan), "checkpoint plan");
  same(journal.envelopeHash, voucherDigest(envelope), "checkpoint envelope");
  check(Number.isSafeInteger(step) && step >= 1 && step <= envelope.boundaries.length, "step range");
  check(journal.completed.length === step - 1 || journal.completed.length === step, "noncontiguous boundary prefix");
  for (const [i, previous] of journal.completed.entries()) {
    check(previous.step === i + 1, "checkpoint order");
    const paid = journal.attempts[previous.transactionHash.toLowerCase()];
    check(
      paid && paid.status === 1 && paid.actualCostWei === previous.actualCostWei,
      "completed charged attempt missing",
    );
  }
  const b = envelope.boundaries[step - 1],
    existing = journal.completed.find((e) => e.step === step);
  check(expectedNonce === (b.kind === "create" ? b.nonce : b.outerNonce), "explicit expected EOA nonce");
  if (existing && receiptHash) same(existing.transactionHash, receiptHash, "conflicting prior receipt");
  if (journal.pending)
    check(journal.pending.step === step && journal.pending.nonce === expectedNonce, "different pending boundary");
  if (journal.pending?.transactionHash && receiptHash)
    same(journal.pending.transactionHash, receiptHash, "conflicting pending receipt");
  let transactionHash = existing?.transactionHash ?? receiptHash ?? journal.pending?.transactionHash;
  if (!transactionHash) {
    check(!journal.pending, "ambiguous previous submit; reconcile exact receipt first");
    for (const previous of journal.completed) await port.reverifyCompleted(previous, journal.completed.length);
    sourceExecutionRemainingBudget(journal, envelope, step - 1);
    await port.assertPreconditions(step, journal);
    check((await port.getPendingNonce(b.from)) === expectedNonce, "live pending EOA nonce drift");
    await port.revalidateBindings();
    if (b.kind === "safe" && !input.safeSubmission)
      return {
        state: "needs-external-safe-signatures" as const,
        boundary: exportSourceSafeBoundary(
          plan.ownerCalls[step - plan.deployments.length - 1],
          b,
          manifest.authority.address,
        ),
      };
    if (b.kind === "safe") {
      assertSourceSignedSafeCalldata(input, step, input.safeSubmission!.data);
      await input.safeSubmission!.preflight();
      await port.revalidateBindings();
      await port.assertPreconditions(step, journal);
      check(
        (await port.getPendingNonce(b.from)) === expectedNonce,
        "live pending EOA nonce drift after Safe simulation",
      );
    } else check(input.operatorSubmitCreate && !input.safeSubmission, "normal operator signer adapter required");
    journal.pending = {
      step,
      from: b.from,
      nonce: expectedNonce,
      dataHash: sourceBoundaryIntentHash(input, step),
      gasLimit: b.gasLimit,
      maxFeeWei: b.maxFeeWei,
    };
    await writeJournal(journal);
    await port.revalidateBindings();
    transactionHash =
      b.kind === "safe"
        ? await input.safeSubmission!.submit()
        : await input.operatorSubmitCreate!(plan.deployments[step - 1], b);
    check(/^0x[\da-f]{64}$/i.test(transactionHash), "invalid submitted transaction hash; reconcile only");
    journal.pending.transactionHash = transactionHash;
    await writeJournal(journal);
  }
  const evidence = await verifySourceExecutionBoundary({
    ...input,
    transactionHash,
    pausedSnapshots: journal.pausedSnapshots,
    recordMatchedAttempt: async (attempt) => {
      const key = attempt.transactionHash.toLowerCase(),
        previous = journal.attempts[key];
      if (previous) same(voucherDigest(previous), voucherDigest(attempt), "paid attempt evidence drift");
      journal.attempts[key] = attempt;
      await writeJournal(journal);
    },
  });
  for (const previous of journal.completed)
    await port.reverifyCompleted(previous, Math.max(journal.completed.length, step));
  sourceExecutionRemainingBudget(journal, envelope, step);
  if (!existing) {
    const call = plan.ownerCalls[step - plan.deployments.length - 1];
    if (b.kind === "safe" && call.action === "pause") {
      const state = await port.getProxyState(call.target, evidence.blockNumber);
      journal.pausedSnapshots[call.target] = {
        blockNumber: evidence.blockNumber,
        blockHash: evidence.blockHash,
        preservedHash: voucherDigest(state.preserved),
      };
    }
    journal.completed.push(evidence);
  }
  delete journal.pending;
  await writeJournal(journal);
  return { state: existing ? ("already-verified" as const) : ("verified" as const), evidence };
}
