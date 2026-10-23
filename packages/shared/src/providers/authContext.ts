import { createContext } from "react";
import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import type { AuthMode, SmartAccountClientResolver } from "../types/auth";
import type { PasskeyAccountProfileId } from "../modules/auth/account-profile";
import type {
  PilotAccountPreview,
  PilotAccountQuote,
} from "../modules/auth/pilot-account-enrollment";

// CONTEXT TYPES

/**
 * Read-only auth state — changes on every auth event.
 * Use `useAuthState()` for components that only read state (avoids re-renders from action ref changes).
 */
export interface AuthStateValue {
  authMode: AuthMode;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: Error | null;
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  passkeyAccountProfile?: PasskeyAccountProfileId | null;
  smartAccountClient: SmartAccountClient | null;
  resolveSmartAccountClient: SmartAccountClientResolver | null;
  userName: string | null;
  hasStoredCredential: boolean;
  walletAddress: Hex | null;
  eoaAddress: Hex | undefined;
  embeddedAddress: Hex | null;
  externalWalletConnected: boolean;
  externalWalletAddress: Hex | null;
}

/**
 * Mutation functions — stable references via useCallback.
 * Use `useAuthActions()` for components that only trigger actions (avoids re-renders from state changes).
 */
export interface AuthActionsValue {
  preparePilotAccount?: () => Promise<PilotAccountPreview>;
  findExistingPilotAccount?: () => Promise<PilotAccountPreview | null>;
  quotePilotAccount?: () => Promise<PilotAccountQuote>;
  confirmPilotAccount?: (operationHash?: Hex) => Promise<void>;
  reconcilePilotAccount?: () => Promise<void>;
  cancelPilotAccountEnrollment?: () => void;
  createAccount: (userName: string) => Promise<void>;
  loginWithPasskey: (userName?: string) => Promise<void>;
  loginWithOriginalPasskey?: (userName?: string) => Promise<void>;
  loginWithWallet: () => void;
  loginWithEmbedded: () => void;
  signOut: () => Promise<void>;
  switchToWallet: () => void;
  switchToPasskey: (userName?: string) => void;
  retry: () => void;
  dismissError: () => void;

  // Session management
  clearPasskey: () => void;
  disconnectWallet: () => Promise<void>;
}

/**
 * Combined auth context — full backward compatibility.
 */
export interface AuthContextType extends AuthStateValue, AuthActionsValue {}

export const AuthStateContext = createContext<AuthStateValue | undefined>(undefined);
export const AuthActionsContext = createContext<AuthActionsValue | undefined>(undefined);
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
