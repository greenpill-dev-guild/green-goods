import { createContext } from "react";
import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import type {
  AuthMode,
  OpenfortSignInMethod,
  SmartAccountClientResolver,
  WalletConnectFailure,
  WalletRestoreState,
} from "../types/auth";
import type { PasskeyAccountProfileId } from "../modules/auth/account-profile";
import type { OpenfortEmailSession } from "../modules/auth/openfort-wallet";
import type {
  PilotAccountPreview,
  PilotAccountQuote,
} from "../modules/auth/pilot-account-enrollment";

/** Read state without subscribing to action-reference changes. */
export interface AuthStateValue {
  /** An abandoned connector needs an explicit fresh-page retry. */
  walletReleaseStalled?: boolean;
  /** The last wallet sign-in ended without the wallet answering; cleared by the next attempt. */
  walletConnectFailure?: WalletConnectFailure | null;
  /** A wallet account whose wallet has not answered yet, or null once it has. */
  walletRestore?: WalletRestoreState | null;
  authMode: AuthMode;
  /** The session is known: signed out, or signed in, including a wallet account still restoring. */
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
  /** "email" for an email session (Openfort); null for every other session. */
  openfortMethod?: OpenfortSignInMethod | null;
  externalWalletConnected: boolean;
  externalWalletAddress: Hex | null;
}

/** Stable mutations for consumers that do not need auth state. */
export interface AuthActionsValue {
  preparePilotAccount?: () => Promise<PilotAccountPreview>;
  findExistingPilotAccount?: () => Promise<PilotAccountPreview | null>;
  quotePilotAccount?: () => Promise<PilotAccountQuote>;
  confirmPilotAccount?: (operationHash?: Hex) => Promise<void>;
  reconcilePilotAccount?: () => Promise<void>;
  cancelPilotAccountEnrollment?: () => void;
  createAccount: (userName: string) => Promise<void>;
  loginWithPasskey: (userName?: string, options?: { createIfMissing?: boolean }) => Promise<void>;
  loginWithOriginalPasskey?: (userName?: string) => Promise<void>;
  loginWithWallet: () => void;
  loginWithConnectedWallet?: (expectedAddress: Hex) => boolean;
  loginWithEmbedded: () => void;
  /** Email a one-time code. Ends any Openfort session left on this device first. */
  requestSignInCode?: (email: string) => Promise<void>;
  /** Sign in with the emailed code; the machine reports progress and errors like a passkey's. */
  loginWithCode?: (email: string, code: string) => Promise<void>;
  loginWithOpenfortSession?: (session: OpenfortEmailSession) => Promise<void>;
  signOut: () => Promise<void>;
  switchToWallet: () => void;
  switchToPasskey: (userName?: string) => void;
  retry: () => void;
  dismissError: () => void;

  // Session management
  clearPasskey: () => void;
  disconnectWallet: () => Promise<void>;
}

/** Combined auth context retained for existing consumers. */
export interface AuthContextType extends AuthStateValue, AuthActionsValue {}

export const AuthStateContext = createContext<AuthStateValue | undefined>(undefined);
export const AuthActionsContext = createContext<AuthActionsValue | undefined>(undefined);
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
