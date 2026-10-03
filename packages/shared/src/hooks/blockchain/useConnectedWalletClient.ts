/**
 * useConnectedWalletClient
 *
 * The connected wallet's client, whatever network the wallet is on.
 *
 * wagmi's `useWalletClient()` asks for a client on the app's last configured
 * network and returns none while the wallet sits anywhere else, which includes
 * every network outside the app's list. A write hook that takes its client from
 * it then stops with "not connected" before its network guard can switch the
 * wallet. Asking for the client on the connection's own network keeps one
 * available. Each write still names its network: the guard switches first
 * (`ensureAppKitWalletChain`), and viem refuses to send on any other.
 *
 * @module hooks/blockchain/useConnectedWalletClient
 */

import { useAccount, useWalletClient } from "wagmi";

export function useConnectedWalletClient() {
  const { chainId } = useAccount();
  return useWalletClient({ chainId });
}
