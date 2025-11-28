/**
 * Hook to access user information
 *
 * This hook provides a simplified interface for accessing user data,
 * supporting both wallet (EOA) and passkey (smart account) authentication.
 *
 * @example
 * ```tsx
 * function ProfileComponent() {
 *   const { user, eoa, smartAccountAddress, ready } = useUser();
 *
 *   if (!ready) return <Loader />;
 *
 *   return (
 *     <div>
 *       <p>EOA: {eoa?.address}</p>
 *       <p>Smart Account: {smartAccountAddress}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useEnsName } from "../blockchain/useEnsName";
import { useAuth } from "./useAuth";
import type { SmartAccountClient } from "permissionless";

interface User {
  id: string;
  wallet: {
    address: string;
  };
}

interface UseUserReturn {
  user: User | null;
  ready: boolean;
  eoa: { address: string } | null;
  smartAccountAddress: string | null;
  smartAccountClient: SmartAccountClient | null;
  authMode: "wallet" | "passkey" | null;
  ensName: string | null;
}

export function useUser(): UseUserReturn {
  const auth = useAuth();

  // Support both PasskeyAuth and WalletAuth
  const eoaAddress = (
    "walletAddress" in auth ? auth.walletAddress : (auth as any).smartAccountAddress
  ) as `0x${string}` | undefined;
  const smartAccountAddress = (auth as any).smartAccountAddress as `0x${string}` | null;
  const address = (eoaAddress || smartAccountAddress) as string | undefined;
  const ready = ("ready" in auth ? auth.ready : (auth as any).isReady) as boolean;
  const isConnected = (
    "isConnected" in auth ? auth.isConnected : (auth as any).isAuthenticated
  ) as boolean;
  const { data: ensName } = useEnsName(eoaAddress); // Use eoaAddress for ENS lookup

  // Get smart account details if using PasskeyAuth
  const smartAccountClient = "smartAccountClient" in auth ? auth.smartAccountClient : null;

  // For simple wallet-only auth (admin), we only have EOA
  const eoa = address ? { address: address as string } : null;

  // Create user object for backward compatibility
  const user = address
    ? {
        id: address,
        wallet: { address },
      }
    : null;

  return {
    user,
    ready,
    eoa,
    smartAccountAddress,
    smartAccountClient: smartAccountClient as any,
    authMode: "authMode" in auth ? (auth.authMode as any) : isConnected ? "wallet" : null,
    ensName: ensName ?? null,
  };
}
