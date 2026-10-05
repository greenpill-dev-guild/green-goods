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

// The chain registry selects Alchemy locally and PublicNode without a provider key in CI.
// Both transports may perform only the declared reverse-name read, never a write.
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
    payload.params[0]?.to !== "0xeeeeeeee14d718c2b47d9923deab1335e144eeee" ||
    typeof payload.params[0]?.data !== "string" ||
    !payload.params[0].data.startsWith("0xb7d6ca64")
  ) {
    throw new Error("Unsupported exploration ENS request");
  }
  return {
    jsonrpc: "2.0",
    id: payload.id,
    error: { code: 3, message: "No reverse ENS name in this scenario" },
  };
}
