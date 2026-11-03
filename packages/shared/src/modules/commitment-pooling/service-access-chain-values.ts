import { isAddress, type Hex } from "viem";
import type { Address } from "../../types/domain";

export type ServiceTuple = Record<string, unknown>;
export const SERVICE_ZERO_HASH = `0x${"0".repeat(64)}` as Hex;
export const SERVICE_ZERO_ADDRESS = `0x${"0".repeat(40)}` as Address;
export const GREEN_GOODS_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19" as Address;
/** Administered by the Green Goods Safe alone; the Safe's owner roles may be held here. */
export const GREEN_GOODS_ACCESS_MANAGER = "0xfBf07b2d0e5eA8249756F205e5214B9d7cDF4e66" as Address;

/** True when `owner` is `authority`, or the access manager when `authority` is the Green Goods Safe. */
export function serviceOwnerIs(owner: string, authority: string): boolean {
  const live = owner.toLowerCase();
  const pinned = authority.toLowerCase();
  return (
    live === pinned ||
    (pinned === GREEN_GOODS_SAFE.toLowerCase() && live === GREEN_GOODS_ACCESS_MANAGER.toLowerCase())
  );
}

export function serviceTuple(value: unknown, fields: readonly string[]): ServiceTuple {
  if (Array.isArray(value)) {
    if (value.length !== fields.length) throw new Error("Malformed service ABI tuple length");
    return Object.fromEntries(fields.map((field, index) => [field, value[index]]));
  }
  if (!value || typeof value !== "object" || fields.some((field) => !(field in value)))
    throw new Error("Malformed service ABI tuple");
  return value as ServiceTuple;
}

export function serviceUint(value: unknown, bits = 256): bigint {
  if (typeof value !== "bigint" || value < 0n || value >= 1n << BigInt(bits))
    throw new Error("Invalid service ABI integer");
  return value;
}

/** Viem returns uint32 as a number; the ABI bound proves this conversion is exact. */
export function serviceUint32(value: unknown): bigint {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw new Error("Invalid service ABI uint32");
  return BigInt(value);
}

export function serviceEnum(value: unknown, choices: readonly string[]): string {
  if (typeof value !== "number" || !Number.isInteger(value) || choices[value] === undefined)
    throw new Error("Unsupported service ABI discriminator");
  return choices[value]!;
}

export function serviceAddress(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value))
    throw new Error("Invalid service ABI account");
  return value.toLowerCase() as Address;
}

export function serviceHash(value: unknown): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value))
    throw new Error("Invalid service ABI hash");
  return value.toLowerCase() as Hex;
}

export function serviceFlag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid service ABI flag");
  return value;
}

export function serviceChainId(value: unknown): number {
  const parsed = serviceUint(value, 64);
  if (parsed === 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Invalid service chain identity");
  return Number(parsed);
}
