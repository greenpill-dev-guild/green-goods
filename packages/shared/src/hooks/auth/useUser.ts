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

import type { SmartAccountClient } from "permissionless";
import { useEnsName } from "../blockchain/useEnsName";
import { useAuth } from "./useAuth";

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

  // Use unified auth interface properties
  const authMode = auth.authMode ?? null;
  const isReady = auth.isReady ?? false;
  const isAuthenticated = auth.isAuthenticated ?? false;

  // Get addresses from unified interface
  const eoaAddress = auth.eoaAddress;
  const smartAccountAddress = auth.smartAccountAddress ?? null;

  // For wallet-only auth, walletAddress might be available
  const walletAddress = "walletAddress" in auth ? auth.walletAddress : undefined;

  // Determine the primary address for this user
  const primaryAddress = eoaAddress ?? walletAddress ?? smartAccountAddress ?? undefined;

  // Get smart account client if available
  const smartAccountClient =
    "smartAccountClient" in auth ? (auth.smartAccountClient as SmartAccountClient | null) : null;

  // Use EOA address for ENS lookup (smart accounts don't have ENS)
  const { data: ensName } = useEnsName(eoaAddress ?? walletAddress);

  // Create EOA object if we have an address
  const eoa = primaryAddress ? { address: primaryAddress as string } : null;

  // Create user object for backward compatibility
  const user =
    isAuthenticated && primaryAddress
      ? {
          id: primaryAddress as string,
          wallet: { address: primaryAddress as string },
        }
      : null;

  return {
    user,
    ready: isReady,
    eoa,
    smartAccountAddress: smartAccountAddress as string | null,
    smartAccountClient,
    authMode,
    ensName: ensName ?? null,
  };
}
