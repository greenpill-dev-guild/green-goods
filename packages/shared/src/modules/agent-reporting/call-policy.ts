import { type Hex, pad, toFunctionSelector, toHex } from "viem";
import type { GrantPurpose } from "./grants";

/**
 * The exact EAS `attest` calls a delegated Kernel permission may make, as 32-byte word rules over
 * the calldata after the selector. Rules pin every head pointer as well as the schema, recipient
 * and request defaults: without the pointers, a non-canonical encoding could satisfy each word
 * rule while ABI decoding reads a different recipient elsewhere in the calldata. The rules do not
 * see inside the attestation data; the restricted executor validates that against the frozen
 * envelope before signing. Offsets follow the Kernel call policy convention (after the selector).
 */
export interface AttestScope {
  purpose: GrantPurpose;
  easAddress: Hex;
  schemaUID: Hex;
  gardenAddress: Hex;
}

export interface WordRule {
  offset: number;
  equals: Hex;
  field:
    | "request_pointer"
    | "schema"
    | "data_pointer"
    | "recipient"
    | "expiration_time"
    | "revocable"
    | "ref_uid"
    | "bytes_pointer"
    | "value";
}

export const ATTEST_SELECTOR = toFunctionSelector(
  "attest((bytes32,(address,uint64,bool,bytes32,bytes,uint256)))"
);

const word = (value: bigint | Hex): Hex =>
  typeof value === "bigint" ? pad(toHex(value), { size: 32 }) : pad(value, { size: 32 });

export function attestWordRules(scope: AttestScope): WordRule[] {
  return [
    { offset: 0x00, equals: word(0x20n), field: "request_pointer" },
    { offset: 0x20, equals: word(scope.schemaUID), field: "schema" },
    { offset: 0x40, equals: word(0x40n), field: "data_pointer" },
    { offset: 0x60, equals: word(scope.gardenAddress.toLowerCase() as Hex), field: "recipient" },
    { offset: 0x80, equals: word(0n), field: "expiration_time" },
    { offset: 0xa0, equals: word(0n), field: "revocable" },
    { offset: 0xc0, equals: word(0n), field: "ref_uid" },
    { offset: 0xe0, equals: word(0xc0n), field: "bytes_pointer" },
    { offset: 0x100, equals: word(0n), field: "value" },
  ];
}

export type CallRuleFailure =
  | "wrong_target"
  | "wrong_selector"
  | "nonzero_value"
  | "truncated"
  | WordRule["field"];

/** Offline evaluation of the same rules the on-chain call policy applies. */
export function attestCallFailures(
  scope: AttestScope,
  call: { to: Hex; value: bigint; data: Hex }
): CallRuleFailure[] {
  const failures: CallRuleFailure[] = [];
  if (call.to.toLowerCase() !== scope.easAddress.toLowerCase()) failures.push("wrong_target");
  if (call.value !== 0n) failures.push("nonzero_value");
  if (call.data.slice(0, 10).toLowerCase() !== ATTEST_SELECTOR) failures.push("wrong_selector");
  const body = call.data.slice(10);
  for (const rule of attestWordRules(scope)) {
    const start = rule.offset * 2;
    const actual = body.slice(start, start + 64);
    if (actual.length < 64) {
      failures.push("truncated");
      break;
    }
    if (`0x${actual}`.toLowerCase() !== rule.equals.toLowerCase()) failures.push(rule.field);
  }
  return [...new Set(failures)];
}
