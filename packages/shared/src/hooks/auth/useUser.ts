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
  const address = ('address' in auth ? auth.address : (auth.walletAddress || auth.smartAccountAddress)) as string | undefined;
  const ready = ('ready' in auth ? auth.ready : auth.isReady) as boolean;
  const isConnected = ('isConnected' in auth ? auth.isConnected : auth.isAuthenticated) as boolean;
  const { data: ensName } = useEnsName(address);
  
  // Get smart account details if using PasskeyAuth
  const smartAccountAddress = ('smartAccountAddress' in auth ? auth.smartAccountAddress : null) as string | null;
  const smartAccountClient = ('smartAccountClient' in auth ? auth.smartAccountClient : null);

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
    smartAccountClient,
    authMode: 'authMode' in auth ? auth.authMode : (isConnected ? "wallet" : null),
    ensName: ensName ?? null,
  };
}
