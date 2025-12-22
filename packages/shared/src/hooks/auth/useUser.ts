/**
 * Hook to access user information
 *
 * This hook provides a simplified interface for accessing user data,
 * supporting both wallet (EOA) and passkey (smart account) authentication.
 *
 * Address Resolution Rules:
 * - authMode === "wallet": Use walletAddress (the connected wallet EOA)
 * - authMode === "passkey": Use smartAccountAddress (the passkey smart account)
 * - authMode === null: Not authenticated, no primary address
 *
 * The hook also exposes externalWalletAddress which is always tracked
 * regardless of auth mode (useful for showing "switch to wallet" option).
 *
 * @example
 * ```tsx
 * function ProfileComponent() {
 *   const { user, eoa, smartAccountAddress, authMode, ready } = useUser();
 *
 *   if (!ready) return <Loader />;
 *
 *   // Primary address for the current auth mode
 *   const primaryAddress = authMode === "wallet" ? eoa?.address : smartAccountAddress;
 *
 *   return (
 *     <div>
 *       <p>Auth Mode: {authMode}</p>
 *       <p>Primary Address: {primaryAddress}</p>
 *       {authMode === "passkey" && <p>Smart Account: {smartAccountAddress}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import type { SmartAccountClient } from "permissionless";
import { useMemo } from "react";
import { useEnsName } from "../blockchain/useEnsName";
import { useAuth } from "./useAuth";

interface User {
  id: string;
  wallet: {
    address: string;
  };
}

interface UseUserReturn {
  /** User object for backward compatibility */
  user: User | null;
  /** Whether auth state is ready (not initializing) */
  ready: boolean;
  /** EOA object (only set when authMode === "wallet") */
  eoa: { address: string } | null;
  /** Smart account address (only set when authMode === "passkey") */
  smartAccountAddress: string | null;
  /** Smart account client for transactions (passkey mode only) */
  smartAccountClient: SmartAccountClient | null;
  /** Current authentication mode */
  authMode: "wallet" | "passkey" | null;
  /** ENS name for the primary address */
  ensName: string | null;
  /** External wallet connected (available for switching) */
  externalWalletConnected: boolean;
  /** External wallet address (may differ from walletAddress in passkey mode) */
  externalWalletAddress: string | null;
  /** Primary address based on current auth mode */
  primaryAddress: string | null;
}

export function useUser(): UseUserReturn {
  const auth = useAuth();

  // Get auth state from context
  const authMode = auth.authMode ?? null;
  const isReady = auth.isReady ?? false;
  const isAuthenticated = auth.isAuthenticated ?? false;

  // Get addresses from auth context
  const smartAccountAddress = auth.smartAccountAddress ?? null;
  const walletAddress = auth.walletAddress ?? null;
  const externalWalletConnected = auth.externalWalletConnected ?? false;
  const externalWalletAddress = auth.externalWalletAddress ?? null;

  // Get smart account client (passkey mode only)
  const smartAccountClient = auth.smartAccountClient ?? null;

  // Determine primary address based on auth mode
  // This is the address that should be used for membership checks, transactions, etc.
  const primaryAddress = useMemo(() => {
    if (authMode === "wallet" && walletAddress) {
      return walletAddress;
    }
    if (authMode === "passkey" && smartAccountAddress) {
      return smartAccountAddress;
    }
    return null;
  }, [authMode, walletAddress, smartAccountAddress]);

  // Use primary address for ENS lookup
  // For wallet mode: use wallet address
  // For passkey mode: use smart account address (though it won't have ENS)
  const { data: ensName } = useEnsName(primaryAddress);

  // Create EOA object only when wallet is the primary auth
  const eoa = useMemo(() => {
    if (authMode === "wallet" && walletAddress) {
      return { address: walletAddress };
    }
    return null;
  }, [authMode, walletAddress]);

  // Create user object for backward compatibility
  const user = useMemo(() => {
    if (!isAuthenticated || !primaryAddress) {
      return null;
    }
    return {
      id: primaryAddress,
      wallet: { address: primaryAddress },
    };
  }, [isAuthenticated, primaryAddress]);

  return {
    user,
    ready: isReady,
    eoa,
    smartAccountAddress,
    smartAccountClient,
    authMode,
    ensName: ensName ?? null,
    externalWalletConnected,
    externalWalletAddress,
    primaryAddress,
  };
}
