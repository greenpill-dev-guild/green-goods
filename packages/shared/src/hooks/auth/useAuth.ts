/**
 * Authentication Hooks
 *
 * Re-exports authentication hooks from providers for convenience.
 * - usePasskeyAuth: For client package (passkey + wallet auth)
 * - useWalletAuth: For admin package (wallet-only auth)
 *
 * @example Client package:
 * ```tsx
 * import { usePasskeyAuth } from '@greengoods/shared/hooks/auth';
 * 
 * function MyComponent() {
 *   const { smartAccountAddress, isReady, createPasskey } = usePasskeyAuth();
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
export {
	usePasskeyAuth,
	type AuthMode,
} from "../../providers/PasskeyAuthProvider";
export { useWalletAuth } from "../../providers/WalletAuthProvider";

// For backward compatibility, export usePasskeyAuth as useAuth
// TODO: Update all imports to use usePasskeyAuth or useWalletAuth explicitly
export { usePasskeyAuth as useAuth } from "../../providers/PasskeyAuthProvider";
