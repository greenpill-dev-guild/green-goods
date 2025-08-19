// Purpose: Capability switch + signer stub for EIP-7702 (future support)
// For now, provides a no-op detection and plain EOA signer fallback.

import { createWalletClient, http, custom, type EIP1193Provider } from "viem";
import { getDefaultChain } from "@/config";

export function isEip7702Supported(): boolean {
  // Stub until networks enable 7702
  return false;
}

export async function get7702Signer(getEthProvider: () => Promise<unknown>) {
  const chain = getDefaultChain();
  const maybeProvider = await getEthProvider();
  const isProvider =
    typeof maybeProvider === "object" &&
    maybeProvider !== null &&
    typeof (maybeProvider as { request?: unknown }).request === "function";
  const provider = isProvider ? (maybeProvider as EIP1193Provider) : undefined;
  // For now return a plain wallet client; 7702 flow to be implemented later
  return createWalletClient({
    chain,
    transport: provider ? custom(provider) : http(),
  });
}
