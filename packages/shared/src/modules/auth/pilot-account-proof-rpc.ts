import {
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  encodeFunctionData,
  decodeFunctionResult,
} from "viem";

/** Ordinary public JSON-RPC reads; no bundler, browser credential or wallet port. */
export type PilotProofClient = Pick<PublicClient, "request">;
export type RpcObject = Record<string, unknown>;

export function object(value: unknown, label: string): RpcObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid pilot ${label}`);
  return value as RpcObject;
}
export function hex(value: unknown, label: string, bytes?: number): Hex {
  if (
    typeof value !== "string" ||
    !/^0x(?:[\da-f]{2})*$/i.test(value) ||
    (bytes !== undefined && value.length !== 2 + 2 * bytes)
  )
    throw new Error(`Invalid pilot ${label}`);
  return value.toLowerCase() as Hex;
}
export function quantity(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-f][\da-f]*)$/i.test(value))
    throw new Error(`Invalid pilot ${label}`);
  return BigInt(value);
}
export function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Pilot ${label} mismatch`);
}
export async function read(
  input: { client: PilotProofClient },
  to: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  block: Hex,
  from?: Address
) {
  try {
    const data = encodeFunctionData({ abi, functionName, args });
    const result = await input.client.request({
      method: "eth_call",
      params: [{ to, data, ...(from ? { from } : {}) }, block],
    });
    return decodeFunctionResult({ abi, functionName, data: result });
  } catch {
    // RPC/ABI errors can contain the complete captured WebAuthn signature in their request.
    throw new Error(`Pilot proof read failed: ${functionName}`);
  }
}
