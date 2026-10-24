import {
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  type Hex,
  multicall3Abi,
} from "viem";

/** A bounded read-only action plan. The seed, not wall time, owns every variation. */
export function workExplorationCases(seedText = "17") {
  if (!/^[1-9]\d*$/.test(seedText) || Number(seedText) > 0xffffffff) {
    throw new Error("Exploration seed must be an integer from 1 to 4294967295");
  }
  let state = Number(seedText);
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return [false, true].map((recovery) => ({
    seed: seedText,
    now: "2026-10-05T12:00:00Z",
    recovery,
    role: (next() % 2 ? "steward" : "user") as "steward" | "user",
    viewport: { width: [390, 768, 1280][next() % 3], height: 844 },
    feedback: `${1 + (next() % 99)} native trees planted — café 🌱 ${seedText}`,
    actions: ["open", ...(recovery ? ["recover"] : []), "inspect", "reload"] as string[],
  }));
}

export function assertExplorationNavigation(url: string, origin: string, pathname: string) {
  const actual = new URL(url);
  if (actual.origin !== origin || actual.pathname !== pathname) {
    throw new Error(`Out-of-scope exploration navigation: ${actual.origin}${actual.pathname}`);
  }
}

const ENS_UNIVERSAL_RESOLVER = "0xeeeeeeee14d718c2b47d9923deab1335e144eeee";
const REVERSE_NAME_READ = "0xb7d6ca64";
const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";
/** The universal resolver's answer for an address with no reverse name; viem reads it as none. */
export const NO_REVERSE_NAME = encodeErrorResult({
  abi: [{ type: "error", name: "ResolverNotFound", inputs: [{ name: "name", type: "bytes" }] }],
  errorName: "ResolverNotFound",
  args: ["0x"],
});

/**
 * How many declared reverse-name reads a call makes: one sent to the universal resolver, or
 * a list's reads batched into one multicall3 `aggregate3`, every one of them that same read.
 * Null for anything else.
 */
function reverseNameReads(call: { to?: unknown; data?: unknown } | undefined): number | null {
  if (typeof call?.to !== "string" || typeof call.data !== "string") return null;
  const to = call.to.toLowerCase();
  if (to === ENS_UNIVERSAL_RESOLVER) return call.data.startsWith(REVERSE_NAME_READ) ? 1 : null;
  if (to !== MULTICALL3) return null;
  try {
    const { functionName, args } = decodeFunctionData({
      abi: multicall3Abi,
      data: call.data as Hex,
    });
    if (functionName !== "aggregate3") return null;
    const reads = args[0];
    return reads.length > 0 &&
      reads.every(
        (read) =>
          read.target.toLowerCase() === ENS_UNIVERSAL_RESOLVER &&
          read.callData.startsWith(REVERSE_NAME_READ)
      )
      ? reads.length
      : null;
  } catch {
    return null;
  }
}

// The chain registry selects Alchemy locally and PublicNode without a provider key in CI.
// Both transports may perform only the declared reverse-name read, alone or batched into one
// multicall, never a write.
export function explorationEnsRejection(url: string, method: string, body: string | null) {
  const target = new URL(url);
  if (!["eth-mainnet.g.alchemy.com", "ethereum-rpc.publicnode.com"].includes(target.hostname)) {
    return null;
  }
  const payload = JSON.parse(body ?? "null");
  if (
    target.protocol !== "https:" ||
    method !== "POST" ||
    payload?.jsonrpc !== "2.0" ||
    !(
      typeof payload.id === "string" ||
      (typeof payload.id === "number" && Number.isFinite(payload.id))
    ) ||
    payload.method !== "eth_call" ||
    !Array.isArray(payload.params) ||
    payload.params.length !== 2 ||
    payload.params[1] !== "latest" ||
    reverseNameReads(payload.params[0]) === null
  ) {
    throw new Error("Unsupported exploration ENS request");
  }
  const reads = reverseNameReads(payload.params[0]) as number;
  if (payload.params[0].to.toLowerCase() === MULTICALL3) {
    // Each batched read answers that the address has no reverse name.
    return {
      jsonrpc: "2.0",
      id: payload.id,
      result: encodeFunctionResult({
        abi: multicall3Abi,
        functionName: "aggregate3",
        result: Array.from({ length: reads }, () => ({
          success: false,
          returnData: NO_REVERSE_NAME,
        })),
      }),
    };
  }
  return {
    jsonrpc: "2.0",
    id: payload.id,
    error: { code: 3, message: "No reverse ENS name in this scenario" },
  };
}
