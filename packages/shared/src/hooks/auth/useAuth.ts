/**
 * Authentication Hooks
 *
 * Re-exports authentication hooks from providers for convenience.
 * - useClientAuth: For client package (passkey + wallet orchestration)
 * - usePasskeyAuth: For passkey-only auth
 * - useWalletAuth: For admin package (wallet-only auth)
 *
 * @example Client package:
 * ```tsx
 * import { useClientAuth } from '@greengoods/shared/hooks/auth';
 *
 * function MyComponent() {
 *   const { smartAccountAddress, walletAddress, authMode, createPasskey } = useClientAuth();
 *   // ...
 * }
 * ```
 *
 * @example Admin package:
 * ```tsx
 * import { useWalletAuth } from '@greengoods/shared/hooks/auth';
 *
 * function MyComponent() {
 *   const { address, isConnected, connect } = useWalletAuth();
 *   // ...
 * }
 * ```
 */
import { useOptionalClientAuth } from "../../providers/ClientAuthProvider";
import { useOptionalWalletAuth } from "../../providers/WalletAuthProvider";

export { useClientAuth, type AuthMode } from "../../providers/ClientAuthProvider";
export { usePasskeyAuth } from "../../providers/PasskeyAuthProvider";
export { useWalletAuth } from "../../providers/WalletAuthProvider";

export function useAuth() {
  const clientAuth = useOptionalClientAuth();
  const walletAuth = useOptionalWalletAuth();

  // Return whichever context is available, prioritizing client auth (more specific)
  // If neither is available, return empty object (useUser handles this safely)
  return clientAuth ?? walletAuth ?? {};
}
