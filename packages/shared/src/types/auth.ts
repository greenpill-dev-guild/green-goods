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
 * - null: Not authenticated
 */
export type AuthMode = "wallet" | "passkey" | null;

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
