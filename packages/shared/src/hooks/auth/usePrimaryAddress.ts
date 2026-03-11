/**
 * Hook to get the primary address based on current auth mode
 *
 * This is the SINGLE SOURCE OF TRUTH for determining which address
 * should be used for membership checks, transactions, ownership, etc.
 *
 * Address Resolution Rules:
 * - authMode === "wallet": Returns walletAddress (the connected wallet EOA)
 * - authMode === "passkey": Returns smartAccountAddress (the passkey smart account)
 * - authMode === "embedded": Returns embeddedAddress (AppKit embedded wallet)
 * - authMode === null: Returns null (not authenticated)
 *
 * @example
 * ```tsx
 * import { usePrimaryAddress } from '@green-goods/shared/hooks';
 *
 * function MyComponent() {
 *   const primaryAddress = usePrimaryAddress();
 *
 *   if (!primaryAddress) return <LoginPrompt />;
 *
 *   return <div>Connected as: {primaryAddress}</div>;
 * }
 * ```
 */

import type { Hex } from "viem";
import { useAuth } from "./useAuth";

/**
 * Get the primary address for the current auth mode.
 *
 * - Passkey mode → smartAccountAddress
 * - Embedded mode → embeddedAddress (AppKit email/social wallet)
 * - Wallet mode → walletAddress
 * - Unauthenticated → null
 */
export function usePrimaryAddress(): Hex | null {
  const { authMode, smartAccountAddress, walletAddress, embeddedAddress } = useAuth();

  if (authMode === "passkey" && smartAccountAddress) {
    return smartAccountAddress;
  }
  if (authMode === "embedded" && embeddedAddress) {
    return embeddedAddress;
  }
  if (authMode === "wallet" && walletAddress) {
    return walletAddress;
  }
  return null;
}

/**
 * Pure function version for use outside React components.
 * Useful in callbacks, event handlers, or non-React code.
 */
export function getPrimaryAddress(
  authMode: "wallet" | "passkey" | "embedded" | null,
  walletAddress: Hex | null | undefined,
  smartAccountAddress: Hex | null | undefined,
  embeddedAddress?: Hex | null | undefined
): Hex | null {
  if (authMode === "passkey" && smartAccountAddress) {
    return smartAccountAddress;
  }
  if (authMode === "embedded" && embeddedAddress) {
    return embeddedAddress;
  }
  if (authMode === "wallet" && walletAddress) {
    return walletAddress;
  }
  return null;
}
