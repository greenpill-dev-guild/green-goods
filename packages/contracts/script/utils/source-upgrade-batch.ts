import { concat, Interface, keccak256, solidityPacked, toUtf8Bytes, TypedDataEncoder } from "ethers";
import type { SourceUpgradePlan } from "./source-upgrade-release";
import type { SourcePublicReceipt } from "./source-upgrade-execution-types";
import { assertSourceSafeSuccess, SOURCE_SAFE_EXECUTION, sourceSafeTypedData } from "./source-upgrade-safe-execution";

// Safe's canonical v1.5.0 deployment; observed on Arbitrum and checked against safe-deployments.
export const SOURCE_MULTISEND = Object.freeze({
  address: "0xA83c336B20401Af773B6219BA5027174338D1836",
  runtimeHash: "0xcdbdcec38d2f1c7d961b0029ff8416b7e86e9974d6f0e9c9580c7d17fcfb6663",
});
const MULTISEND = new Interface(["function multiSend(bytes transactions)"]);
const OWNER = new Interface(["function setPaused(bool)", "function upgradeTo(address)"]);
const ORDER = ["pooling:pause", "pooling:upgrade", "settlement:pause", "settlement:upgrade"];
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(`Source Safe batch ${label}`);
}
export function buildSourceSafeBatch(plan: SourceUpgradePlan, nonce: number) {
  check(plan.chainId === 42161 && Number.isSafeInteger(nonce) && nonce >= 0, "chain/nonce");
  check(
    plan.ownerCalls.length === 4 && plan.ownerCalls.every((c, i) => `${c.target}:${c.action}` === ORDER[i]),
    "call order",
  );
  const safe = plan.ownerCalls[0].from;
  for (const c of plan.ownerCalls) {
    check(c.from.toLowerCase() === safe.toLowerCase() && c.value === "0" && c.operation === 0, "zero-value inner CALL");
    if (c.action === "pause") check(c.data === OWNER.encodeFunctionData("setPaused", [true]), "pause calldata");
  }
  const packed = concat(
    plan.ownerCalls.map((c) =>
      solidityPacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [0, c.to, 0, (c.data.length - 2) / 2, c.data],
      ),
    ),
  );
  const typed = sourceSafeTypedData(
    plan.ownerCalls[0],
    {
      step: 24,
      kind: "safe",
      from: safe,
      gasLimit: "2000000",
      maxFeeWei: "50000000",
      priorityFeeWei: "0",
      safeTxGas: "0",
      baseGas: "0",
    },
    safe,
  );
  const message = {
    ...typed.message,
    to: SOURCE_MULTISEND.address,
    data: MULTISEND.encodeFunctionData("multiSend", [packed]),
    operation: 1,
    nonce,
  };
  const safeTransactionHash = TypedDataEncoder.hash(typed.domain, { SafeTx: typed.types.SafeTx }, message);
  return { ...typed, message, safeTransactionHash };
}
export type SourceSafeBatch = ReturnType<typeof buildSourceSafeBatch>;

// Transaction Builder's documented checksum serialization; metadata name is deliberately excluded.
function builderSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(builderSerialize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>,
      keys = Object.keys(object).sort();
    return `{${JSON.stringify(keys)}${keys.map((k) => `${builderSerialize(object[k])},`).join("")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}
export function sourceBatchBuilderFile(plan: SourceUpgradePlan, ready: boolean, createdAt = Date.now()) {
  buildSourceSafeBatch(plan, plan.ownerCalls[0].safeNonce);
  const file = {
    version: "1.0",
    chainId: "42161",
    createdAt,
    meta: {
      name: ready ? "Green Goods paused source upgrades" : "DRAFT - Green Goods paused source upgrades",
      description: ready
        ? "Four ordered zero-value CALLs. Compare the companion SafeTx hash and nonce before signing. Ends paused; no activation."
        : "DRAFT: addresses are predictions. Do not sign before all CREATE receipts and the exact atomic rehearsal are verified.",
      createdFromSafeAddress: plan.ownerCalls[0].from,
      createdFromOwnerAddress: "",
    },
    transactions: plan.ownerCalls.map((c) => ({ to: c.to, value: "0", data: c.data })),
  };
  return {
    ...file,
    meta: {
      ...file.meta,
      checksum: keccak256(toUtf8Bytes(builderSerialize({ ...file, meta: { ...file.meta, name: null } }))),
    },
  };
}
export function assertSourceBatchOuter(data: string, batch: SourceSafeBatch) {
  const decoded = SOURCE_SAFE_EXECUTION.decodeFunctionData("execTransaction", data),
    m = batch.message;
  const expected = [m.to, 0, m.data, 1, 0, 0, 0, m.gasToken, m.refundReceiver, decoded[9]];
  check(decoded[9] !== "0x", "owner signatures missing");
  check(
    SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", expected).toLowerCase() === data.toLowerCase(),
    "exact atomic calldata/refund policy",
  );
}
export function assertSourceBatchSuccess(logs: SourcePublicReceipt["logs"], batch: SourceSafeBatch) {
  assertSourceSafeSuccess(logs, batch.domain.verifyingContract, batch.safeTransactionHash);
}
