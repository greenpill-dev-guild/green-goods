import { concat, recoverAddress, Signature } from "ethers";
import { voucherDigest } from "./voucher-release";
import {
  assertSourceSafeOuterCalldata,
  SOURCE_SAFE_EXECUTION,
  sourceSafeTransactionHash,
} from "./source-upgrade-safe-execution";
import type { SourceExecutionContext } from "./source-upgrade-execution-types";

export interface SourceSafeSignature {
  schemaVersion: 1;
  sourceCommit: string;
  planHash: string;
  envelopeHash: string;
  step: number;
  safeTransactionHash: string;
  owner: string;
  signature: string;
}
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(`Source Safe signature ${label}`);
}
function signingContext(context: SourceExecutionContext, step: number) {
  const boundary = context.envelope.boundaries[step - 1];
  const call = context.plan.ownerCalls[step - context.plan.deployments.length - 1];
  check(boundary?.kind === "safe" && call, "requires an owner boundary");
  return { boundary, call, hash: sourceSafeTransactionHash(call, boundary, context.manifest.authority.address) };
}
function owner(context: SourceExecutionContext, hash: string, signature: unknown) {
  check(typeof signature === "string" && /^0x[\da-f]{130}$/i.test(signature), "requires a 65-byte EIP-712 signature");
  const parsed = Signature.from(signature);
  check([27, 28].includes(Number.parseInt(signature.slice(-2), 16)), "requires EIP-712 v=27/28");
  const recovered = recoverAddress(hash, parsed);
  check(
    context.manifest.authority.owners.some((a) => a.toLowerCase() === recovered.toLowerCase()),
    "is not an original owner",
  );
  return { owner: recovered, signature: parsed.serialized };
}
export function sourceSafeSignature(
  context: SourceExecutionContext,
  step: number,
  signature: string,
): SourceSafeSignature {
  const { hash } = signingContext(context, step);
  return {
    schemaVersion: 1,
    sourceCommit: context.plan.sourceCommit,
    planHash: voucherDigest(context.plan),
    envelopeHash: voucherDigest(context.envelope),
    step,
    safeTransactionHash: hash,
    ...owner(context, hash, signature),
  };
}
function readSignature(context: SourceExecutionContext, step: number, value: unknown) {
  check(value !== null && typeof value === "object" && !Array.isArray(value), "record shape");
  const record = value as SourceSafeSignature;
  const expected = sourceSafeSignature(context, step, record.signature);
  check(voucherDigest(record) === voucherDigest(expected), "record does not match the reviewed boundary");
  return expected;
}
export function sourceSafeSignedCalldata(context: SourceExecutionContext, step: number, records: unknown[]) {
  check(records.length === 2 && context.manifest.authority.threshold === 2, "requires exactly two owner signatures");
  const signed = records
    .map((r) => readSignature(context, step, r))
    .sort((a, b) => (BigInt(a.owner) < BigInt(b.owner) ? -1 : 1));
  check(signed[0].owner !== signed[1].owner, "requires distinct owners");
  const { call, boundary } = signingContext(context, step);
  return SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", [
    call.to,
    0,
    call.data,
    0,
    boundary.safeTxGas,
    boundary.baseGas,
    0,
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    concat(signed.map((r) => r.signature)),
  ]);
}
/** New submissions use two canonical EIP-712 EOA signatures. Existing external receipt adoption remains unchanged. */
export function assertSourceSignedSafeCalldata(context: SourceExecutionContext, step: number, data: string) {
  const { call, hash } = signingContext(context, step);
  assertSourceSafeOuterCalldata(data, call);
  const signatures = SOURCE_SAFE_EXECUTION.decodeFunctionData("execTransaction", data)[9] as string;
  check(/^0x[\da-f]{260}$/i.test(signatures), "requires two fixed-size EIP-712 signatures");
  const first = owner(context, hash, signatures.slice(0, 132));
  const second = owner(context, hash, `0x${signatures.slice(132)}`);
  check(BigInt(first.owner) < BigInt(second.owner), "owners must be distinct and sorted");
}
