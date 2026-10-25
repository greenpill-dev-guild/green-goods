import type { JsonRpcProvider } from "ethers";
import { SOURCE_EXECUTION_POLICY as POLICY, validateSourceExecutionEnvelope } from "./source-upgrade-execution";
import type { SourceExecutionContext, SourceExecutionEnvelope, SourceSafePins } from "./source-upgrade-execution-types";
import { prepareSourceUpgradeBaseline } from "./source-upgrade-readback";
import { voucherDigest } from "./voucher-release";

export type SourceUpgradePreparationInput = Omit<SourceExecutionContext, "envelope"> & {
  provider: Parameters<typeof prepareSourceUpgradeBaseline>[0]["provider"] & Pick<JsonRpcProvider, "estimateGas">;
  abis: Parameters<typeof prepareSourceUpgradeBaseline>[0]["abis"];
  safePins: SourceSafePins;
  otherArbitrumReservedWei: string;
};
type GasQuote = {
  step: number;
  kind: "create" | "safe";
  estimateGas?: string;
  gasLimit: string;
  basis: "estimate-plus-30-percent" | "conservative-safe-outer-maximum";
};
function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`Source execution preparation ${label}`);
}
function nonce(value: number) {
  check(Number.isSafeInteger(value) && value >= 0, "unsafe boundary nonce");
  return value;
}
/** The caller supplies regenerated plan/runtime and the complete saved rehearsal, including its extra evidence. */
export async function prepareSourceUpgradeExecution(
  input: SourceUpgradePreparationInput,
): Promise<{ envelope: SourceExecutionEnvelope; gasQuotes: GasQuote[] }> {
  const { provider, abis } = input;
  const { plan, manifest, runtime, rehearsal, safePins, otherArbitrumReservedWei } = structuredClone({
    plan: input.plan,
    manifest: input.manifest,
    runtime: input.runtime,
    rehearsal: input.rehearsal,
    safePins: input.safePins,
    otherArbitrumReservedWei: input.otherArbitrumReservedWei,
  });
  check(
    typeof otherArbitrumReservedWei === "string" && /^(0|[1-9][0-9]*)$/.test(otherArbitrumReservedWei),
    "explicit other Arbitrum reservation required",
  );
  check(plan.chainId === POLICY.chainId && manifest.chainId === POLICY.chainId, "chain mismatch");
  check(
    manifest.deployer !== null && manifest.nonce !== null && manifest.authority.nonce !== null,
    "missing concrete deployer or nonce",
  );
  const baseline = await prepareSourceUpgradeBaseline({ provider, abis, manifest, safePins });
  const boundaries: SourceExecutionEnvelope["boundaries"] = [];
  const gasQuotes: GasQuote[] = [];
  for (const [index, deployment] of plan.deployments.entries()) {
    check(deployment.to === null && deployment.value === "0", "CREATE must have no target and zero native value");
    const estimate = await provider.estimateGas({
      chainId: POLICY.chainId,
      from: deployment.from,
      to: null,
      nonce: nonce(deployment.nonce),
      data: deployment.data,
      value: 0n,
      maxFeePerGas: POLICY.maxFeeWei,
      maxPriorityFeePerGas: 0n,
    });
    check(typeof estimate === "bigint" && estimate > 0n, "invalid CREATE gas estimate");
    const gasLimit = String((estimate * 130n + 99n) / 100n);
    boundaries.push({
      step: index + 1,
      kind: "create",
      from: deployment.from,
      nonce: deployment.nonce,
      gasLimit,
      maxFeeWei: String(POLICY.maxFeeWei),
      priorityFeeWei: "0",
      runtimeHash: runtime.deployments[index]?.runtimeHash,
    });
    gasQuotes.push({
      step: index + 1,
      kind: "create",
      estimateGas: String(estimate),
      gasLimit,
      basis: "estimate-plus-30-percent",
    });
  }
  for (const [index, call] of plan.ownerCalls.entries()) {
    check(call.value === "0" && call.operation === 0, "Safe call must be a direct zero-value call");
    const step = plan.deployments.length + index + 1;
    // This is a reserved maximum, not an estimate of an execTransaction containing real owner signatures.
    const gasLimit = "2000000";
    boundaries.push({
      step,
      kind: "safe",
      from: manifest.deployer,
      outerNonce: nonce(manifest.nonce + step - 1),
      safeNonce: nonce(manifest.authority.nonce + index),
      gasLimit,
      maxFeeWei: String(POLICY.maxFeeWei),
      priorityFeeWei: "0",
      safeTxGas: "0",
      baseGas: "0",
    });
    gasQuotes.push({ step, kind: "safe", gasLimit, basis: "conservative-safe-outer-maximum" });
  }
  const envelope: SourceExecutionEnvelope = {
    chainId: POLICY.chainId,
    planHash: voucherDigest(plan),
    manifestHash: voucherDigest(manifest),
    sourceCommit: plan.sourceCommit,
    artifactHashes: plan.artifactHashes,
    runtimeBindingHash: runtime.bindingHash,
    compilerJobHashes: Object.fromEntries(runtime.deployments.map((d) => [d.key, d.compilerJobHash])),
    rehearsalHash: voucherDigest(rehearsal),
    maxFeeWei: String(POLICY.maxFeeWei),
    hatsSpentWei: String(POLICY.hatsSpentWei),
    gasBudgetWei: String(POLICY.gasBudgetWei),
    ccipBudgetWei: String(POLICY.ccipBudgetWei),
    otherArbitrumReservedWei,
    safePins,
    baseline,
    boundaries,
  };
  validateSourceExecutionEnvelope({ plan, manifest, runtime, rehearsal, envelope });
  const observation = await provider.getBlock(manifest.observation.blockNumber);
  check(
    observation?.number === manifest.observation.blockNumber &&
      observation.hash?.toLowerCase() === manifest.observation.blockHash.toLowerCase(),
    "canonical observation changed during estimation",
  );
  return { envelope, gasQuotes };
}
