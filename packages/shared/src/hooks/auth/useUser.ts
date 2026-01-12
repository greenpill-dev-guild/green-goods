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
 *   const { user, eoa, smartAccountAddress, authMode, ready, primaryAddress } = useUser();
 *
 *   if (!ready) return <Loader />;
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
import { useAuth } from "./useAuth";
import { usePrimaryAddress } from "./usePrimaryAddress";

export interface User {
  id: string;
  wallet: {
    address: string;
  };
}

export interface UseUserReturn {
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
  /** Passkey username (only set when authMode === "passkey") */
  userName: string | null;
  /** ENS name for the primary address - REMOVED to fix QueryClient error */
  ensName: null;
  /** External wallet connected (available for switching) */
  externalWalletConnected: boolean;
  /** External wallet address (may differ from walletAddress in passkey mode) */
  externalWalletAddress: string | null;
  /** Primary address based on current auth mode */
  primaryAddress: string | null;
}

export function useUser(): UseUserReturn {
  const auth = useAuth();
  const primaryAddress = usePrimaryAddress();

  // Extract auth state with null defaults for type safety
  const {
    authMode = null,
    isReady = false,
    isAuthenticated = false,
    smartAccountAddress = null,
    walletAddress = null,
    userName = null,
    externalWalletConnected = false,
    externalWalletAddress = null,
    smartAccountClient = null,
  } = auth;

  // Create EOA object only when wallet is the primary auth (React 19 compiler handles memoization)
  const eoa = authMode === "wallet" && walletAddress ? { address: walletAddress } : null;

  // Create user object for backward compatibility (React 19 compiler handles memoization)
  const user =
    isAuthenticated && primaryAddress
      ? { id: primaryAddress, wallet: { address: primaryAddress } }
      : null;

  return {
    user,
    ready: isReady,
    eoa,
    smartAccountAddress,
    smartAccountClient,
    authMode,
    userName,
    ensName: null, // Disabled - useEnsName was called before QueryClient was available
    externalWalletConnected,
    externalWalletAddress,
    primaryAddress,
  };
}
