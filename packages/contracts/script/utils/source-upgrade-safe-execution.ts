import { Interface, TypedDataEncoder, ZeroAddress } from "ethers";
import { voucherDigest } from "./voucher-release";
import type { SourceUpgradeManifest } from "./source-upgrade-release";
import type {
  OwnerCall,
  SourceSafePins,
  SourceSafeState,
  SourceExecutionEnvelope,
  SourceBoundaryAdoption,
  SourcePublicReceipt,
} from "./source-upgrade-execution-types";

export const SOURCE_SAFE_EXECUTION = new Interface([
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns(bool)",
  "event ExecutionSuccess(bytes32 txHash,uint256 payment)",
  "event ExecutionFailure(bytes32 txHash,uint256 payment)",
]);
// The pinned live singleton indexes txHash; older Safe receipts used two data words.
const INDEXED_SAFE_EVENTS = new Interface([
  "event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)",
  "event ExecutionFailure(bytes32 indexed txHash,uint256 payment)",
]);
function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`Source execution ${label}`);
}
function same(actual: unknown, expected: unknown, label: string) {
  check(
    actual !== undefined && expected !== undefined && String(actual).toLowerCase() === String(expected).toLowerCase(),
    label,
  );
}
export function assertSourceSafeAuthority(
  state: SourceSafeState,
  authority: SourceUpgradeManifest["authority"],
  pins: SourceSafePins,
) {
  check(
    state.threshold === authority.threshold && state.threshold === 2 && authority.owners.length === 5,
    "original 2-of-5 Safe threshold",
  );
  same(
    voucherDigest(state.owners.map((o) => o.toLowerCase())),
    voucherDigest(authority.owners.map((o) => o.toLowerCase())),
    "Safe owners/order",
  );
  for (const key of ["runtimeHash", "singleton", "singletonRuntimeHash"] as const)
    same(state[key], pins[key], `Safe ${key}`);
  same(state.guard, ZeroAddress, "Safe guard");
  same(state.moduleGuard, ZeroAddress, "Safe module guard");
  check(state.modules.length === 0, "Safe modules");
}
export function sourceSafeTypedData(call: OwnerCall, b: SourceExecutionEnvelope["boundaries"][number], safe: string) {
  return {
    domain: { chainId: 42161, verifyingContract: safe },
    primaryType: "SafeTx",
    types: {
      EIP712Domain: [
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      SafeTx: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" },
        { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
    },
    message: safeMessage(call, b),
  };
}
function safeMessage(call: OwnerCall, b: SourceExecutionEnvelope["boundaries"][number]) {
  return {
    to: call.to,
    value: 0,
    data: call.data,
    operation: 0,
    safeTxGas: b.safeTxGas!,
    baseGas: b.baseGas!,
    gasPrice: 0,
    gasToken: ZeroAddress,
    refundReceiver: ZeroAddress,
    nonce: call.safeNonce,
  };
}
export function sourceSafeTransactionHash(
  call: OwnerCall,
  b: SourceExecutionEnvelope["boundaries"][number],
  safe: string,
): string {
  const typed = sourceSafeTypedData(call, b, safe);
  return TypedDataEncoder.hash(typed.domain, { SafeTx: typed.types.SafeTx }, typed.message);
}
export function exportSourceSafeBoundary(
  call: OwnerCall,
  b: SourceExecutionEnvelope["boundaries"][number],
  safe: string,
) {
  return {
    safe,
    chainId: 42161,
    ...safeMessage(call, b),
    value: "0",
    safeTxGas: b.safeTxGas,
    baseGas: b.baseGas,
    gasPrice: "0",
    safeTransactionHash: sourceSafeTransactionHash(call, b, safe),
    outer: {
      from: b.from,
      nonce: b.outerNonce,
      gasLimit: b.gasLimit,
      maxFeePerGas: b.maxFeeWei,
      maxPriorityFeePerGas: "0",
    },
  };
}

export function assertSourceSafeOuterCalldata(data: string, call: OwnerCall) {
  const decoded = SOURCE_SAFE_EXECUTION.decodeFunctionData("execTransaction", data);
  same(decoded[0], call.to, "Safe inner target");
  same(decoded[2], call.data, "Safe inner calldata");
  check(
    [1, 3, 4, 5, 6].every((i) => decoded[i] === 0n),
    "Safe operation/value/gas/refund",
  );
  same(decoded[7], ZeroAddress, "Safe refund token");
  same(decoded[8], ZeroAddress, "Safe refund receiver");
  check(decoded[9] !== "0x", "normal Safe signatures missing");
  same(
    SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", Array.from(decoded)),
    data,
    "noncanonical Safe outer ABI",
  );
}
export async function verifySourceSafeReceipt(
  input: SourceBoundaryAdoption,
  receipt: SourcePublicReceipt,
  entirePrefixLength: number,
) {
  const { plan, manifest, envelope, step, port } = input;
  const call = plan.ownerCalls[step - plan.deployments.length - 1];
  const safeHash = sourceSafeTransactionHash(call, envelope.boundaries[step - 1], manifest.authority.address);
  const events = receipt.logs
    .filter((log) => log.address.toLowerCase() === manifest.authority.address.toLowerCase())
    .flatMap((log) => {
      for (const abi of [SOURCE_SAFE_EXECUTION, INDEXED_SAFE_EVENTS]) {
        try {
          const parsed = abi.parseLog(log);
          if (parsed) return [parsed];
        } catch {
          // Try the other supported event layout; both still require exact Safe/hash/payment checks.
        }
      }
      return [];
    });
  const successes = events.filter((event) => event.name === "ExecutionSuccess");
  check(
    successes.length === 1 && !events.some((event) => event.name === "ExecutionFailure"),
    "one successful direct Safe execution required",
  );
  same(successes[0].args.txHash, safeHash, "Safe event hash/nonce");
  check(successes[0].args.payment === 0n, "Safe payment");
  const authority = await port.getSafeState(receipt.blockNumber);
  assertSourceSafeAuthority(authority, manifest.authority, envelope.safePins);
  check(
    entirePrefixLength > step ? authority.nonce >= call.safeNonce + 1 : authority.nonce === call.safeNonce + 1,
    "Safe nonce after boundary",
  );
  return safeHash;
}
