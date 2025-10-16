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

import { useAuth, type AuthMode } from "@/hooks/auth/useAuth";
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
  authMode: AuthMode;
}

export function useUser(): UseUserReturn {
  const { authMode, walletAddress, smartAccountAddress, smartAccountClient, credential, isReady } =
    useAuth();

  // EOA is available when using wallet authentication
  // Passkey authentication uses smart accounts without traditional EOAs
  const eoa = authMode === "wallet" && walletAddress ? { address: walletAddress } : null;

  // Create user object for backward compatibility
  // Use wallet address for wallet mode, smart account for passkey mode
  const primaryAddress = authMode === "wallet" ? walletAddress : smartAccountAddress;

  const user = primaryAddress
    ? {
        id: authMode === "wallet" ? walletAddress! : credential?.id || primaryAddress,
        wallet: { address: primaryAddress },
      }
    : null;

  return {
    user,
    ready: isReady,
    eoa,
    smartAccountAddress: smartAccountAddress || null,
    smartAccountClient,
    authMode,
  };
}
