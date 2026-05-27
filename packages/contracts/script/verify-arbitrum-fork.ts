import { readFileSync } from "node:fs";

const RPC_URL = process.env.ARBITRUM_FORK_RPC_URL || "http://127.0.0.1:3009";
const ZERO_ADDRESS = /^0x0{40}$/i;
const REQUIRED_ADDRESSES = ["gardenToken", "actionRegistry", "deploymentRegistry"] as const;

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`${method} HTTP ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcResponse<T>;
  if (payload.error) {
    throw new Error(`${method} RPC ${payload.error.code}: ${payload.error.message}`);
  }
  if (payload.result === undefined) {
    throw new Error(`${method} returned no result`);
  }
  return payload.result;
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-f0-9]{40}$/i.test(value);
}

function collectZeroAddressKeys(value: unknown, prefix = "", out: string[] = []): string[] {
  if (!value || typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string" && ZERO_ADDRESS.test(child)) {
      out.push(path);
    } else if (child && typeof child === "object" && !Array.isArray(child)) {
      collectZeroAddressKeys(child, path, out);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const deployment = JSON.parse(
    readFileSync(new URL("../deployments/42161-latest.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;
  const failures: string[] = [];

  const chainId = await rpc<string>("eth_chainId");
  if (Number.parseInt(chainId, 16) !== 42161) {
    failures.push(`expected chain id 42161/0xa4b1, received ${chainId}`);
  }

  const verified: Record<string, string> = {};
  for (const key of REQUIRED_ADDRESSES) {
    const address = deployment[key];
    if (!isAddress(address) || ZERO_ADDRESS.test(address)) {
      failures.push(`${key} is missing or zero in deployments/42161-latest.json`);
      continue;
    }

    const code = await rpc<string>("eth_getCode", [address, "latest"]);
    if (!code || code === "0x") {
      failures.push(`${key} at ${address} has no bytecode on the fork`);
      continue;
    }
    verified[key] = address;
  }

  const zeroAddressKeys = collectZeroAddressKeys(deployment);
  const result = {
    ok: failures.length === 0,
    rpcUrl: RPC_URL,
    chainId,
    verified,
    zeroAddressKeys,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
