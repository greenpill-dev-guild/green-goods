import {
  getLocalArbitrumForkRpcUrl,
  isLocalArbitrumForkMode,
  LOCAL_ARBITRUM_FORK_CHAIN_ID,
  type LocalForkEnv,
} from "../../config/local-fork";
import { ENV } from "../../lib/env";

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

type JsonRpcBlock = {
  hash?: string | null;
  number?: string | null;
};

export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export type LocalForkWriteSafetyOptions = {
  env?: LocalForkEnv;
  provider?: EthereumProvider | null;
  fetchImpl?: typeof fetch;
};

const LOCAL_FORK_WALLET_MESSAGE =
  "Local Arbitrum fork mode is active. Connect a disposable Anvil-funded wallet to http://127.0.0.1:3009 on chain 42161 before sending transactions.";

export function getBrowserEthereumProvider(): EthereumProvider | null {
  const globalWithEthereum = globalThis as typeof globalThis & {
    ethereum?: EthereumProvider;
    window?: { ethereum?: EthereumProvider };
  };
  return globalWithEthereum.window?.ethereum ?? globalWithEthereum.ethereum ?? null;
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = trimmed.startsWith("0x")
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function rpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch
): Promise<T> {
  const response = await fetchImpl(rpcUrl, {
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

async function providerClientLooksLocal(provider: EthereumProvider): Promise<boolean> {
  try {
    const version = await provider.request({ method: "web3_clientVersion" });
    return typeof version === "string" && /anvil|foundry/iu.test(version);
  } catch {
    return false;
  }
}

async function assertProviderMatchesLocalRpc(
  provider: EthereumProvider,
  rpcUrl: string,
  fetchImpl: typeof fetch
): Promise<void> {
  if (await providerClientLooksLocal(provider)) return;

  const [walletBlock, localBlock] = await Promise.all([
    provider.request({
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    }) as Promise<JsonRpcBlock>,
    rpc<JsonRpcBlock>(rpcUrl, "eth_getBlockByNumber", ["latest", false], fetchImpl),
  ]);

  if (walletBlock?.hash && localBlock?.hash && walletBlock.hash === localBlock.hash) {
    return;
  }

  throw new Error(
    `${LOCAL_FORK_WALLET_MESSAGE} The connected wallet is not using the local fork RPC.`
  );
}

export async function assertLocalArbitrumForkWallet(
  options: LocalForkWriteSafetyOptions = {}
): Promise<void> {
  const env = options.env ?? ENV;
  if (!isLocalArbitrumForkMode(env)) return;

  const provider = options.provider ?? getBrowserEthereumProvider();
  if (!provider) {
    throw new Error(`${LOCAL_FORK_WALLET_MESSAGE} No browser wallet provider was found.`);
  }

  const walletChainId = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (walletChainId !== LOCAL_ARBITRUM_FORK_CHAIN_ID) {
    throw new Error(
      `${LOCAL_FORK_WALLET_MESSAGE} The connected wallet is on chain ${walletChainId ?? "unknown"}.`
    );
  }

  const rpcUrl = getLocalArbitrumForkRpcUrl(env);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error(`${LOCAL_FORK_WALLET_MESSAGE} No fetch implementation is available.`);
  }

  const localChainId = parseChainId(await rpc<string>(rpcUrl, "eth_chainId", [], fetchImpl));
  if (localChainId !== LOCAL_ARBITRUM_FORK_CHAIN_ID) {
    throw new Error(
      `${LOCAL_FORK_WALLET_MESSAGE} The local fork RPC returned chain ${localChainId ?? "unknown"}.`
    );
  }

  await assertProviderMatchesLocalRpc(provider, rpcUrl, fetchImpl);
}

export function assertLocalArbitrumForkSmartAccountsDisabled(env: LocalForkEnv = ENV): void {
  if (!isLocalArbitrumForkMode(env)) return;
  throw new Error(
    "Passkey and smart-account transactions are not enabled in local Arbitrum fork mode. Use wallet auth with a disposable Anvil-funded wallet for fork-mode transaction testing."
  );
}
