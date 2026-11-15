import type { SmartAccountClient } from "permissionless";

export type SmartAccountClientResolver = (chainId: number) => Promise<SmartAccountClient>;

/**
 * Authentication Types
 *
 * Base types for authentication across the application.
 * The main auth context type is defined in providers/Auth.tsx (AuthContextType).
 */

/**
 * Authentication mode type
 * - 'wallet': Traditional EOA wallet authentication (admin package)
 * - 'passkey': WebAuthn passkey with smart account (client package)
 * - 'embedded': AppKit embedded wallet via email/social login (client package)
 * - null: Not authenticated
 */
export type AuthMode = "wallet" | "passkey" | "embedded" | null;

/**
 * A wallet account whose wallet has not answered. The App opens on the
 * remembered account without waiting for it (PRD-1499), so for a while the
 * session can read but not sign:
 * - 'restoring': the App is still asking the wallet to come back, at launch or
 *   after the connection dropped
 * - 'failed': the wallet did not answer in time; the account stays signed in
 *   and the wallet is asked again on return or reconnection
 */
export type WalletRestoreState = "restoring" | "failed";

/**
 * Why the last wallet sign-in ended without the wallet answering:
 * - 'timeout': a phone wallet was chosen and its app never came to the front
 * - 'connect_error': the wallet chooser reported a failed connection
 */
export type WalletConnectFailure = "timeout" | "connect_error";

/**
 * Base authentication context properties
 * All auth providers should include these core fields
 */
export interface BaseAuthContext {
  /** Whether the auth provider has finished initializing */
  isReady: boolean;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether an authentication action is in progress */
  isAuthenticating?: boolean;
  /** Current authentication mode */
  authMode: AuthMode;
}
