// Purpose: Build a Kernel (or Light fallback) ERC-4337 smart account client
// from a Privy embedded EOA, using Pimlico bundler/paymaster.
// Inputs: getEthProvider (Privy embedded wallet provider getter)
// Side-effects: network calls to inspect code/deployment

import { createPublicClient, createWalletClient, custom, http, type EIP1193Provider } from "viem";
import {
  createSmartAccountClient,
  type SmartAccountClient as PLSmartAccountClient,
} from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { getDefaultChain, getNetworkConfig, getPimlicoRpcUrl } from "@/config";
import { toKernelSmartAccount, toLightSmartAccount } from "permissionless/accounts";
import type { SmartAccount } from "viem/account-abstraction";

type GetEthProvider = () => Promise<unknown>;

export interface BuiltAaClient {
  client: PLSmartAccountClient;
  account: SmartAccount;
  address: `0x${string}`;
  deployed: boolean;
}

const AA_DEBUG = import.meta.env.DEV || import.meta.env.VITE_AA_DEBUG === "true";
const AA_TAG = "[AA]";

export async function buildKernelClientFromPrivyEOA(
  getEthProvider: GetEthProvider
): Promise<BuiltAaClient> {
  const chain = getDefaultChain();
  const net = getNetworkConfig(chain.id);
  void AA_TAG; // preserve tag for potential non-console debug integrations
  void AA_DEBUG;

  const provider = (await getEthProvider()) as EIP1193Provider;
  const walletClient = createWalletClient({ chain, transport: custom(provider) });
  const publicClient = createPublicClient({ chain, transport: http() });
  // toOwner converts a Wallet Client into a signer for accounts in permissionless v0.2.x
  const { toOwner } = await import("permissionless");
  const owner = await toOwner({
    owner: walletClient as unknown as Parameters<typeof toOwner>[0]["owner"],
  });

  // Deterministic index: 0n is enough for per-owner determinism
  const index = 0n;

  // Prefer Kernel; fallback to Light
  let account: SmartAccount;
  try {
    const entryPoint = net.contracts?.erc4337EntryPoint
      ? ({ address: net.contracts.erc4337EntryPoint as `0x${string}`, version: "0.7" } as const)
      : undefined;
    account = await toKernelSmartAccount({
      owners: [owner],
      entryPoint,
      index,
    } as unknown as Parameters<typeof toKernelSmartAccount>[0]);
  } catch {
    const entryPoint = net.contracts?.erc4337EntryPoint
      ? ({ address: net.contracts.erc4337EntryPoint as `0x${string}`, version: "0.7" } as const)
      : undefined;
    account = await toLightSmartAccount({
      owner,
      entryPoint,
      index,
    } as unknown as Parameters<typeof toLightSmartAccount>[0]);
  }

  const bundlerUrl = getPimlicoRpcUrl(chain.id);
  void bundlerUrl;

  // Create Pimlico client (bundler transport used below). Paymaster optional; not wired yet.
  createPimlicoClient({ chain, transport: http(bundlerUrl) });
  // Paymaster shares same RPC URL; sponsorship can be added later if needed

  const client = createSmartAccountClient({ account, chain, bundlerTransport: http(bundlerUrl) });

  const code = await publicClient.getCode({ address: account.address as `0x${string}` });
  const deployed = !!code && code !== "0x";

  return { client, account, address: account.address as `0x${string}`, deployed };
}
