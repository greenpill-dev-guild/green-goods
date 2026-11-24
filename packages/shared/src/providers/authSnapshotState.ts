import type { AuthMode, WalletRestoreState } from "../types/auth";
import type { AuthSnapshot } from "../workflows/authActor";

/** What the provider knows beside the machine: the wallet connector and the saved passkey. */
interface AuthSnapshotFacts {
  walletRestore: WalletRestoreState | null;
  isConnecting: boolean;
  walletModalOpen: boolean;
  hasStoredCredential: boolean;
}

/**
 * The auth state every consumer reads, derived from the machine's snapshot and the provider's
 * facts. Pure, so the mode a session reports is decided in one place.
 */
export function deriveAuthSnapshotState(
  snapshot: AuthSnapshot | undefined,
  facts: AuthSnapshotFacts
) {
  if (!snapshot) {
    return {
      authMode: null as AuthMode,
      isReady: false,
      isAuthenticated: false,
      isAuthenticating: false,
      error: null,
      credential: null,
      smartAccountAddress: null,
      passkeyAccountProfile: null,
      smartAccountClient: null,
      resolveSmartAccountClient: null,
      userName: null,
      hasStoredCredential: false,
      walletAddress: null,
      embeddedAddress: null,
      openfortMethod: null,
      externalWalletConnected: false,
      externalWalletAddress: null,
    };
  }

  // Determine auth mode from state
  let authMode: AuthMode = null;
  if (snapshot.matches({ authenticated: "passkey" })) {
    authMode = "passkey";
  } else if (snapshot.matches({ authenticated: "openfort" })) {
    authMode = "openfort";
  } else if (snapshot.matches({ authenticated: "embedded" })) {
    authMode = "embedded";
  } else if (snapshot.matches({ authenticated: "wallet" }) || facts.walletRestore !== null) {
    authMode = "wallet";
  } else if (snapshot.matches({ restoring: "embedded" }) && snapshot.context.embeddedAddress) {
    authMode = "embedded";
  }

  const isAuthenticating =
    snapshot.matches("registering") ||
    snapshot.matches("authenticating") ||
    snapshot.matches("authenticating_openfort") ||
    snapshot.matches("wallet_connecting") ||
    snapshot.matches("restoring") ||
    // Wagmi's `isConnecting` only blocks the UI while the wallet modal is
    // actually open. Once the user dismisses it (or a WalletConnect QR
    // expires), the login UI must come back even if wagmi hasn't cleared
    // isConnecting yet — otherwise the input stays disabled and the wallet
    // button stays hidden with no way to recover.
    (facts.isConnecting && facts.walletModalOpen);

  // A remembered wallet account is usable while its wallet is still asked (PRD-1499).
  const waitsOnWallet = snapshot.matches("restoring") && facts.walletRestore !== "restoring";
  const authenticatedSession =
    snapshot.matches("authenticated") ||
    facts.walletRestore !== null ||
    (snapshot.matches({ restoring: "embedded" }) && Boolean(snapshot.context.embeddedAddress));

  return {
    authMode,
    isReady: !snapshot.matches("initializing") && !waitsOnWallet,
    isAuthenticated: authenticatedSession,
    isAuthenticating,
    error: snapshot.context.error,
    credential: snapshot.context.credential,
    smartAccountAddress: snapshot.context.smartAccountAddress,
    passkeyAccountProfile: snapshot.context.passkeyAccountProfile ?? null,
    smartAccountClient: snapshot.context.smartAccountClient,
    resolveSmartAccountClient: snapshot.context.resolveSmartAccountClient,
    userName: snapshot.context.userName,
    // A stored credential indicates an existing account in localStorage.
    hasStoredCredential: facts.hasStoredCredential,
    // Wallet address is only set when wallet is the PRIMARY auth
    walletAddress: snapshot.context.walletAddress,
    // Embedded wallet address (AppKit email/social auth)
    embeddedAddress: snapshot.context.embeddedAddress,
    openfortMethod: snapshot.context.openfortMethod,
    // External wallet state (always available)
    externalWalletConnected: snapshot.context.externalWalletConnected,
    externalWalletAddress: snapshot.context.externalWalletAddress,
  };
}
