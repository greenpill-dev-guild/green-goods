import type { Address } from "./core";

export const VOUCHER_AWARDS_ROUTE = "/public/voucher-awards";
export interface VoucherAwardInput {
  awardId: string;
  reserve: Address;
  token: Address;
  recipient: Address;
  /** Token base units, never a floating point service price. */
  amount: string;
  reason: string;
  reference: string | null;
}
export interface VoucherAwardSafe {
  safe: Address;
  chainId: 100;
  to: Address;
  value: "0";
  data: `0x${string}`;
  operation: 0;
  safeTxGas: "0";
  baseGas: "0";
  gasPrice: "0";
  gasToken: Address;
  refundReceiver: Address;
  nonce: string;
  safeTxHash: `0x${string}`;
  threshold: number;
}
export interface VoucherAwardRecord {
  version: 1;
  award: VoucherAwardInput;
  safe: VoucherAwardSafe;
  state: "awaiting_authorization" | "submitted" | "confirmed" | "failed" | "needs_reconciliation";
  transactionHash: `0x${string}` | null;
  failure: "transaction_reverted" | "safe_execution_failed" | "safe_nonce_changed" | null;
  createdBy: Address;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export type VoucherAwardCommand =
  | { action: "prepare"; award: VoucherAwardInput }
  | { action: "list"; reserve: Address }
  | { action: "received" }
  | { action: "read"; reserve: Address; awardId: string }
  | { action: "reconcile"; reserve: Address; awardId: string; transactionHash: `0x${string}` };
export interface VoucherAwardProof {
  version: 1;
  chainId: 100;
  actor: Address;
  issuedAt: number;
  audience: string;
  command: VoucherAwardCommand;
}
export interface VoucherAwardRequest extends VoucherAwardProof {
  signature: `0x${string}`;
}
export interface VoucherAwardResponse {
  ok: true;
  record?: VoucherAwardRecord;
  records?: VoucherAwardRecord[];
  /** At most the newest 200 records; older records can still be read by their stable ID. */
  limit?: 200;
  /** A full window may omit older records. No completeness claim is made at the limit. */
  partial?: boolean;
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid award request");
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, fields: string[]) => {
  if (Object.keys(value).length !== fields.length || fields.some((field) => !(field in value)))
    throw new Error("Invalid award fields");
};
const address = (value: unknown): Address => {
  if (typeof value !== "string" || !/^0x(?!0{40}$)[a-f\d]{40}$/i.test(value))
    throw new Error("Invalid account");
  return value.toLowerCase() as Address;
};
const id = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,95}$/.test(value))
    throw new Error("Invalid award ID");
  return value;
};
const hasControlCharacters = (value: string) =>
  [...value].some((character) => character.charCodeAt(0) < 32);
export function parseVoucherAwardInput(value: unknown): VoucherAwardInput {
  const v = object(value);
  exact(v, ["awardId", "reserve", "token", "recipient", "amount", "reason", "reference"]);
  if (
    typeof v.amount !== "string" ||
    !/^[1-9]\d{0,77}$/.test(v.amount) ||
    BigInt(v.amount) >= (1n << 256n) - 1n
  )
    throw new Error("Invalid award amount");
  if (
    typeof v.reason !== "string" ||
    !v.reason.trim() ||
    v.reason.length > 240 ||
    hasControlCharacters(v.reason)
  )
    throw new Error("Invalid award reason");
  if (
    v.reference !== null &&
    (typeof v.reference !== "string" ||
      !v.reference.trim() ||
      v.reference.length > 200 ||
      hasControlCharacters(v.reference))
  )
    throw new Error("Invalid award reference");
  const award = {
    awardId: id(v.awardId),
    reserve: address(v.reserve),
    token: address(v.token),
    recipient: address(v.recipient),
    amount: v.amount,
    reason: v.reason.trim(),
    reference: v.reference as string | null,
  };
  if (award.reserve === award.recipient) throw new Error("Reserve cannot award itself");
  return award;
}
export function parseVoucherAwardRequest(
  value: unknown,
  nowSeconds: number,
  audience: string
): VoucherAwardRequest {
  const v = object(value);
  exact(v, ["version", "chainId", "actor", "issuedAt", "audience", "command", "signature"]);
  if (
    v.version !== 1 ||
    v.chainId !== 100 ||
    !Number.isSafeInteger(v.issuedAt) ||
    (v.issuedAt as number) > nowSeconds + 30 ||
    nowSeconds - (v.issuedAt as number) > 300 ||
    v.audience !== audience ||
    !/^https?:\/\//.test(audience) ||
    typeof v.signature !== "string" ||
    !/^0x(?:[a-f\d]{2}){1,8192}$/i.test(v.signature)
  )
    throw new Error("Invalid award proof");
  const c = object(v.command);
  let command: VoucherAwardCommand;
  if (c.action === "prepare") {
    exact(c, ["action", "award"]);
    command = { action: "prepare", award: parseVoucherAwardInput(c.award) };
  } else if (c.action === "received") {
    exact(c, ["action"]);
    command = { action: "received" };
  } else if (c.action === "list") {
    exact(c, ["action", "reserve"]);
    command = { action: "list", reserve: address(c.reserve) };
  } else if (c.action === "read") {
    exact(c, ["action", "reserve", "awardId"]);
    command = { action: "read", reserve: address(c.reserve), awardId: id(c.awardId) };
  } else if (c.action === "reconcile") {
    exact(c, ["action", "reserve", "awardId", "transactionHash"]);
    if (typeof c.transactionHash !== "string" || !/^0x[a-f\d]{64}$/i.test(c.transactionHash))
      throw new Error("Invalid transaction");
    command = {
      action: "reconcile",
      reserve: address(c.reserve),
      awardId: id(c.awardId),
      transactionHash: c.transactionHash.toLowerCase() as `0x${string}`,
    };
  } else throw new Error("Unknown award action");
  return {
    version: 1,
    chainId: 100,
    actor: address(v.actor),
    issuedAt: v.issuedAt as number,
    audience,
    command,
    signature: v.signature as `0x${string}`,
  };
}
/** The complete action is signed; a read authorization cannot authorize a transfer draft. */
export function buildVoucherAwardMessage(proof: VoucherAwardProof): string {
  const normalized = parseVoucherAwardRequest(
    { ...proof, signature: "0x00" },
    proof.issuedAt,
    proof.audience
  );
  const { signature: _, ...content } = normalized;
  return `Green Goods voucher award\n${JSON.stringify(content)}`;
}
